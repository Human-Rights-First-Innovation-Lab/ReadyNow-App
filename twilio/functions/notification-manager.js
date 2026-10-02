/* eslint-disable no-undef */
const crypto = require("crypto");
const mysql = require("mysql2/promise");
const { Expo } = require("expo-server-sdk");

/**
 * Twilio Function entry point for managing ReadyNow push notification tokens.
 *
 * Two separate credentials, on purpose:
 *
 *   TWILIO_API_SECRET      - held by the app, authorises `register` and
 *                            `disable` only. Because it is delivered through an
 *                            EXPO_PUBLIC_ variable it is inlined into the JS
 *                            bundle at build time and must be assumed readable
 *                            by anyone with a copy of the app.
 *   TWILIO_DISPATCH_SECRET - server-side only, never shipped to a client.
 *                            Required for `dispatch`, which pushes to every
 *                            registered device.
 *
 * Previously one secret authorised all three actions, so the credential in
 * every user's phone could broadcast a notification to the entire user base.
 * For an app whose users are preparing for immigration detention, a forged
 * alert - or a forged all-clear - is a physical-safety problem, not a nuisance.
 *
 * Expected environment variables:
 *  - TWILIO_API_SECRET: client-facing secret for register/disable
 *  - TWILIO_DISPATCH_SECRET: server-only secret for dispatch
 *  - DO_MYSQL_HOST
 *  - DO_MYSQL_USER
 *  - DO_MYSQL_PASSWORD
 *  - DO_MYSQL_DATABASE
 *  - DO_MYSQL_CA_CERT (PEM; required, certificate verification is mandatory)
 *  - DO_MYSQL_PORT (optional, defaults to 25060 for DigitalOcean)
 *  - EXPO_ACCESS_TOKEN (Expo push service access token)
 *  - ALLOWED_ORIGIN (optional; only needed to run the app in a browser during
 *    development. Native builds are not subject to CORS.)
 */
exports.handler = async function handler(context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  // No wildcard CORS. Nothing in production is a browser client, and a
  // permissive policy only widened the reach of the client-held secret.
  if (context.ALLOWED_ORIGIN) {
    response.appendHeader("Access-Control-Allow-Origin", context.ALLOWED_ORIGIN);
    response.appendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.appendHeader("Access-Control-Allow-Headers", "Content-Type, X-API-KEY");
  }

  // Handle preflight OPTIONS request
  if (event.request && event.request.method === "OPTIONS") {
    response.setStatusCode(200);
    return callback(null, response);
  }

  const deny = () => {
    response.setStatusCode(401);
    response.setBody(JSON.stringify({ success: false, error: "Unauthorized request" }));
    return callback(null, response);
  };

  let pool;

  try {
    assertConfigured(context);

    const parsedBody =
      typeof event.body === "string" && event.body.length > 0
        ? JSON.parse(event.body)
        : event;

    const action = parsedBody.action;
    const payload = parsedBody.payload ?? {};
    const presented = presentedSecret(event, parsedBody);

    // `dispatch` reaches every registered device, so it requires the
    // server-only secret. The client-held one cannot authorise it.
    const requiredSecret =
      action === "dispatch"
        ? context.TWILIO_DISPATCH_SECRET
        : context.TWILIO_API_SECRET;

    if (!presented || !constantTimeEquals(presented, requiredSecret)) {
      console.warn(`unauthorized ${action || "unknown"} request rejected`);
      return deny();
    }

    pool = await createConnectionPool(context);

    switch (action) {
      case "register":
        await registerDevice(pool, payload);
        response.setStatusCode(200);
        response.setBody(JSON.stringify({ success: true }));
        break;
      case "disable":
        await disableDevice(pool, payload);
        response.setStatusCode(200);
        response.setBody(JSON.stringify({ success: true }));
        break;
      case "dispatch": {
        if (!context.EXPO_ACCESS_TOKEN) {
          throw fail(500, "Service misconfigured", "missing Expo access token");
        }
        const dispatchResult = await dispatchNotifications(
          pool,
          payload,
          context.EXPO_ACCESS_TOKEN
        );
        response.setStatusCode(200);
        response.setBody(JSON.stringify({ success: true, ...dispatchResult }));
        break;
      }
      default:
        response.setStatusCode(400);
        response.setBody(
          JSON.stringify({ success: false, error: "Unsupported action" })
        );
    }

    return callback(null, response);
  } catch (error) {
    // Detail stays here. Returning error.message leaked database hostnames and
    // schema details to an unauthenticated caller.
    console.error(`notification-manager error: ${error && error.message}`);

    response.setStatusCode(error && error.statusCode ? error.statusCode : 500);
    response.setBody(
      JSON.stringify({
        success: false,
        error: (error && error.clientMessage) || "Internal error",
      })
    );
    return callback(null, response);
  } finally {
    if (pool) {
      try {
        await pool.end();
      } catch (e) {
        console.error(`pool close failed: ${e && e.message}`);
      }
    }
  }
};

function fail(statusCode, clientMessage, internalMessage) {
  const err = new Error(internalMessage || clientMessage);
  err.statusCode = statusCode;
  err.clientMessage = clientMessage;
  return err;
}

/**
 * Fail closed on missing configuration.
 *
 * An absent secret must never resolve to "authorised": a sibling function
 * compared an undefined token against an undefined config value and let
 * everyone through.
 */
function assertConfigured(context) {
  const required = [
    "TWILIO_API_SECRET",
    "TWILIO_DISPATCH_SECRET",
    "DO_MYSQL_HOST",
    "DO_MYSQL_USER",
    "DO_MYSQL_PASSWORD",
    "DO_MYSQL_DATABASE",
  ];

  const missing = required.filter((key) => !context[key]);
  if (!readCaCert(context)) missing.push('DO_MYSQL_CA_CERT');
  if (missing.length > 0) {
    throw fail(500, "Service misconfigured", `missing config: ${missing.join(", ")}`);
  }

  if (constantTimeEquals(context.TWILIO_API_SECRET, context.TWILIO_DISPATCH_SECRET)) {
    // Reusing one value for both would restore exactly the capability this
    // split exists to remove.
    throw fail(
      500,
      "Service misconfigured",
      "TWILIO_DISPATCH_SECRET must differ from TWILIO_API_SECRET"
    );
  }
}

function constantTimeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Accepts the header form and the historical body forms, unchanged. */
function presentedSecret(event, parsedBody) {
  const headerApiKey =
    (event.request &&
      event.request.headers &&
      (event.request.headers["x-api-key"] ||
        (typeof event.request.headers.get === "function" &&
          event.request.headers.get("x-api-key")))) ??
    (event.headers && event.headers["x-api-key"]);

  const bodyApiKey =
    parsedBody?.apiKey ??
    parsedBody?.api_key ??
    parsedBody?.auth?.apiKey ??
    parsedBody?.auth?.api_key ??
    parsedBody?.payload?.apiKey ??
    parsedBody?.payload?.api_key ??
    event.apiKey ??
    event.api_key ??
    event.auth?.apiKey ??
    event.auth?.api_key ??
    "";

  return String(headerApiKey ?? bodyApiKey ?? "").trim();
}

/**
 * The DigitalOcean CA certificate.
 *
 * It is ~1.5 kB, and a Serverless environment variable is capped at 450 bytes,
 * so on the Functions Service it ships as a private Asset rather than as
 * DO_MYSQL_CA_CERT. Functions (Classic) has no such Asset and still supplies it
 * through the environment, so both are accepted and the Asset wins.
 *
 * Private Assets are not reachable by URL - they are bundled with the Functions
 * at build time and readable only through Runtime.getAssets().
 */
function readCaCert(context) {
  try {
    const asset = Runtime.getAssets()["/ca.pem"];
    if (asset) return asset.open();
  } catch (err) {
    // No Assets in this runtime, or none deployed. Fall back to the variable.
  }
  return context.DO_MYSQL_CA_CERT;
}

async function createConnectionPool(context) {
  return mysql.createPool({
    host: context.DO_MYSQL_HOST,
    user: context.DO_MYSQL_USER,
    password: context.DO_MYSQL_PASSWORD,
    database: context.DO_MYSQL_DATABASE,
    port: context.DO_MYSQL_PORT ? Number(context.DO_MYSQL_PORT) : 25060,
    // Certificate verification is mandatory. The previous
    // rejectUnauthorized:false fallback meant a missing or misspelt CA cert
    // silently downgraded to an unverified connection.
    ssl: { ca: readCaCert(context), rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

async function registerDevice(pool, payload) {
  const { deviceId, expoPushToken, tokenHash } = payload;

  if (!deviceId || !expoPushToken || !tokenHash) {
    throw fail(400, "Missing required registration parameters");
  }

  if (!Expo.isExpoPushToken(expoPushToken)) {
    throw fail(400, "Invalid push token");
  }

  const statement = `
    INSERT INTO notification_devices
      (device_id, expo_push_token, token_hash, created_at)
    VALUES (?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      expo_push_token = VALUES(expo_push_token),
      token_hash = VALUES(token_hash)
  `;

  await pool.execute(statement, [deviceId, expoPushToken, tokenHash]);
}

async function disableDevice(pool, payload) {
  const { deviceId, tokenHash = null } = payload;

  if (!deviceId) {
    throw fail(400, "Missing deviceId for disable action");
  }

  // Use explicit query strings to avoid dynamic SQL construction
  // This ensures SQL injection safety and makes the code clearer
  let statement, parameters;

  if (tokenHash) {
    statement = `
      UPDATE notification_devices
      SET expo_push_token = NULL,
          token_hash = NULL
      WHERE device_id = ?
        AND token_hash = ?
    `;
    parameters = [deviceId, tokenHash];
  } else {
    statement = `
      UPDATE notification_devices
      SET expo_push_token = NULL,
          token_hash = NULL
      WHERE device_id = ?
    `;
    parameters = [deviceId];
  }

  await pool.execute(statement, parameters);
}

async function dispatchNotifications(pool, payload, expoAccessToken) {
  const {
    title = {},
    body = {},
    data = {},
    sound = "default",
    priority = "high",
  } = payload;

  const [rows] = await pool.execute(
    `
    SELECT expo_push_token
    FROM notification_devices
    WHERE expo_push_token IS NOT NULL
  `
  );

  const expo = new Expo({ accessToken: expoAccessToken, useFcmV1: false });
  const messages = [];

  for (const record of rows) {
    const token = record.expo_push_token;
    if (!Expo.isExpoPushToken(token)) {
      continue;
    }

    const localizedTitle = resolveLocalizedString(title, "ReadyNow Alert");
    const localizedBody = resolveLocalizedString(body, "");

    messages.push({
      to: token,
      sound,
      priority,
      title: localizedTitle,
      body: localizedBody,
      data,
    });
  }

  console.warn(`dispatching notification to ${messages.length} device(s)`);

  const tickets = [];
  const errors = [];

  for (const chunk of expo.chunkPushNotifications(messages)) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "Unknown dispatch error"
      );
    }
  }

  return {
    tickets,
    dispatchedCount: messages.length,
    errors,
  };
}

function resolveLocalizedString(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object") {
    if ("en" in value && typeof value.en === "string") {
      return value.en;
    }

    const firstEntry = Object.values(value).find(
      (entry) => typeof entry === "string"
    );
    if (firstEntry) {
      return firstEntry;
    }
  }

  return fallback;
}

module.exports.__test = {
  assertConfigured,
  constantTimeEquals,
  presentedSecret,
  resolveLocalizedString,
};
