/* eslint-disable no-undef */
const crypto = require("crypto");
const mysql = require("mysql2/promise");

/**
 * Emergency alert intake. See ALERT-DELIVERY-DESIGN.md.
 *
 * Actions:
 *   register - enrol this install's alert credential, proven by an Auth0 token.
 *   stage  - accept an encrypted payload during the button's countdown.
 *            Undecryptable until fire supplies the key.
 *   fire   - supply the key, expand the plan, and send every SMS immediately.
 *   cancel - discard a staged payload the user backed out of.
 *   sweep  - retry ladder, orphan recovery and purge. Called by GitHub Actions.
 *
 * Required environment:
 *   MESSAGING_SERVICE_SID, ALERT_SWEEP_SECRET, ALERT_STATUS_CALLBACK_URL,
 *   AUTH0_DOMAIN,
 *   DO_MYSQL_HOST, DO_MYSQL_USER, DO_MYSQL_PASSWORD, DO_MYSQL_DATABASE,
 *   DO_MYSQL_CA_CERT, and optionally DO_MYSQL_PORT.
 */

const STAGED_TTL_MINUTES = 15;
const FIRED_TTL_HOURS = 6;
const DEDUPE_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 6;
const MAX_CIPHERTEXT_BYTES = 256 * 1024;

// Hard ceiling per user per day. A circuit breaker against a stolen device
// credential, set far above any plausible emergency. Not a rate limit: no real
// user in distress will encounter it.
const DAILY_MESSAGE_CEILING = 500;
const DAILY_MESSAGE_SOFT_ALERT = 50;

// Retry ladder, in minutes after the previous attempt. Attempt 1 is inline at
// fire; attempt 2 is an immediate re-create driven by the status callback.
const RETRY_LADDER_MINUTES = [0, 0, 5, 20, 60, 120];

exports.handler = async function handler(context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  // No CORS headers: no browser client calls this, and a permissive policy
  // would only widen the reach of a stolen credential.

  const respond = (status, body) => {
    response.setStatusCode(status);
    response.setBody(JSON.stringify(body));
    return callback(null, response);
  };

  let pool;

  try {
    assertConfigured(context);

    const body = parseBody(event);
    const action = body.action;

    pool = await createConnectionPool(context);

    if (action === "sweep") {
      if (!authorizeSweep(context, event)) {
        console.error("alert: sweep rejected - missing or wrong sweep secret");
        return respond(401, unauthorized());
      }
      return respond(200, await sweep(context, pool));
    }

    // Registration is the one action authenticated by an Auth0 access token:
    // it is how a device gets a credential in the first place.
    if (action === "register") {
      const userId = await verifyAuth0Token(context, bearerToken(event));
      if (!userId) {
        console.error("alert: register rejected - Auth0 did not accept the access token");
        return respond(401, unauthorized());
      }
      return respond(200, await register(pool, userId, body));
    }

    const actor = await authorizeDevice(pool, event);
    if (!actor) {
      console.error(
        `alert: "${action}" rejected - no registered credential matches this device`
      );
      return respond(401, unauthorized());
    }

    switch (action) {
      case "stage":
        return respond(202, await stage(pool, actor, body));
      case "fire":
        return respond(202, await fire(context, pool, actor, body));
      case "cancel":
        return respond(200, await cancel(pool, actor, body));
      default:
        return respond(400, { success: false, error: "Unsupported action" });
    }
  } catch (err) {
    // Detail stays here. The caller gets a generic message so connection
    // strings and schema details are not echoed to an unauthenticated client.
    console.error(`alert handler error: ${err && err.message}`);

    const status = err && err.statusCode ? err.statusCode : 500;
    const message =
      err && err.clientMessage ? err.clientMessage : "Internal error";

    return respond(status, { success: false, error: message });
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

/* ─────────────────────────── configuration ─────────────────────────── */

function assertConfigured(context) {
  const required = [
    "MESSAGING_SERVICE_SID",
    "ALERT_SWEEP_SECRET",
    "ALERT_STATUS_CALLBACK_URL",
    "AUTH0_DOMAIN",
    "DO_MYSQL_HOST",
    "DO_MYSQL_USER",
    "DO_MYSQL_PASSWORD",
    "DO_MYSQL_DATABASE",
  ];

  const missing = required.filter((key) => !context[key]);
  if (!readCaCert(context)) missing.push('DO_MYSQL_CA_CERT');
  if (missing.length > 0) {
    // Fail closed. A missing secret must never resolve to "authorised" - the
    // retired copy of this function compared an undefined token against an
    // undefined config value and let everyone through.
    throw fail(500, "Service misconfigured", `missing config: ${missing.join(", ")}`);
  }
}

function fail(statusCode, clientMessage, internalMessage) {
  const err = new Error(internalMessage || clientMessage);
  err.statusCode = statusCode;
  err.clientMessage = clientMessage;
  return err;
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
    // Certificate verification is mandatory. There is deliberately no
    // rejectUnauthorized:false fallback - a missing CA cert fails the request
    // rather than silently downgrading to an unverified connection.
    ssl: { ca: readCaCert(context), rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

/* ─────────────────────────── request parsing ────────────────────────── */

function parseBody(event) {
  if (typeof event.body === "string" && event.body.length > 0) {
    try {
      return JSON.parse(event.body);
    } catch (e) {
      throw fail(400, "Malformed request body");
    }
  }
  return event;
}

function bearerToken(event) {
  const header =
    (event.request &&
      event.request.headers &&
      (event.request.headers.authorization ||
        (typeof event.request.headers.get === "function" &&
          event.request.headers.get("authorization")))) ||
    (event.headers && event.headers.authorization) ||
    "";

  const match = /^Bearer\s+(.+)$/i.exec(String(header).trim());
  return match ? match[1] : "";
}

function unauthorized() {
  return { success: false, error: "Unauthorized" };
}

/* ───────────────────────────── authorization ────────────────────────── */

function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function authorizeSweep(context, event) {
  const presented = bearerToken(event);
  if (!presented) return false;
  return constantTimeEquals(presented, context.ALERT_SWEEP_SECRET);
}

/**
 * Credential format is `<credential_id>.<secret>`: the id is a lookup key, the
 * secret is compared in constant time against a stored sha256.
 */
async function authorizeDevice(pool, event) {
  const presented = bearerToken(event);
  if (!presented) return null;

  const separator = presented.indexOf(".");
  if (separator <= 0) return null;

  const credentialId = presented.slice(0, separator);
  const secret = presented.slice(separator + 1);
  if (!secret) return null;

  const [rows] = await pool.execute(
    `SELECT credential_id, user_id, secret_hash
       FROM device_credentials
      WHERE credential_id = ? AND revoked_at IS NULL`,
    [credentialId]
  );
  if (rows.length === 0) return null;

  const presentedHash = crypto.createHash("sha256").update(secret).digest("hex");
  if (!constantTimeEquals(presentedHash, rows[0].secret_hash)) return null;

  await pool.execute(
    `UPDATE device_credentials SET last_used_at = NOW() WHERE credential_id = ?`,
    [credentialId]
  );

  return { userId: rows[0].user_id, credentialId };
}

/* ─────────────────────────────  registration  ───────────────────────── */

/**
 * Verify an Auth0 access token by calling /userinfo.
 *
 * Deliberately not local JWT verification: that would mean shipping a JWKS
 * client and key cache into a Twilio Function for a call that happens once per
 * install, at sign-up, never on the emergency path. A round trip is the
 * cheaper trade.
 */
async function verifyAuth0Token(context, token) {
  if (!token) return null;

  try {
    const res = await fetch(`https://${context.AUTH0_DOMAIN}/userinfo`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.error(`auth0 /userinfo rejected the access token: HTTP ${res.status}`);
      return null;
    }

    const profile = await res.json();
    return profile && profile.sub ? String(profile.sub) : null;
  } catch (err) {
    console.error(`auth0 userinfo failed: ${err && err.message}`);
    return null;
  }
}

/**
 * Enrol a per-install credential. Only the hash is stored, so the secret
 * itself exists nowhere but the device that generated it.
 */
async function register(pool, userId, body) {
  const { credentialId, secretHash } = body;

  if (!isUuid(credentialId)) throw fail(400, "Invalid credentialId");
  if (typeof secretHash !== "string" || !/^[0-9a-f]{64}$/i.test(secretHash)) {
    throw fail(400, "Invalid secretHash");
  }

  // Retiring older credentials for this user keeps a lost or reinstalled
  // device from retaining the ability to fire alerts.
  await pool.execute(
    `UPDATE device_credentials
        SET revoked_at = NOW()
      WHERE user_id = ? AND credential_id <> ? AND revoked_at IS NULL`,
    [userId, credentialId]
  );

  await pool.execute(
    `INSERT INTO device_credentials (credential_id, user_id, secret_hash)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE secret_hash = VALUES(secret_hash), revoked_at = NULL`,
    [credentialId, userId, secretHash.toLowerCase()]
  );

  return { registered: true };
}

/* ───────────────────────────────  stage  ────────────────────────────── */

async function stage(pool, actor, body) {
  const { alertId, ciphertext, planHash } = body;

  if (!isUuid(alertId)) throw fail(400, "Invalid alertId");
  if (!ciphertext || typeof ciphertext !== "string") {
    throw fail(400, "Missing ciphertext");
  }
  if (Buffer.byteLength(ciphertext, "utf8") > MAX_CIPHERTEXT_BYTES) {
    throw fail(413, "Payload too large");
  }

  // Idempotent: a retried stage for the same alert is a no-op.
  await pool.execute(
    `INSERT INTO alerts (alert_id, user_id, state, ciphertext, plan_hash, purge_after)
     VALUES (?, ?, 'staged', ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))
     ON DUPLICATE KEY UPDATE alert_id = alert_id`,
    [alertId, actor.userId, ciphertext, planHash || null, STAGED_TTL_MINUTES]
  );

  await purgeBatch(pool);

  return { staged: true };
}

/* ───────────────────────────────  cancel  ───────────────────────────── */

async function cancel(pool, actor, body) {
  const { alertId } = body;
  if (!isUuid(alertId)) throw fail(400, "Invalid alertId");

  const [rows] = await pool.execute(
    `SELECT state FROM alerts WHERE alert_id = ? AND user_id = ?`,
    [alertId, actor.userId]
  );

  if (rows.length === 0) return { cancelled: true };
  if (rows[0].state !== "staged") {
    throw fail(409, "Alert has already been fired");
  }

  await pool.execute(
    `DELETE FROM alerts WHERE alert_id = ? AND user_id = ? AND state = 'staged'`,
    [alertId, actor.userId]
  );

  return { cancelled: true };
}

/* ────────────────────────────────  fire  ────────────────────────────── */

async function fire(context, pool, actor, body) {
  const { alertId, key, location } = body;
  if (!isUuid(alertId)) throw fail(400, "Invalid alertId");
  if (!key) throw fail(400, "Missing key");

  const [existing] = await pool.execute(
    `SELECT state, ciphertext, plan_hash FROM alerts
      WHERE alert_id = ? AND user_id = ?`,
    [alertId, actor.userId]
  );

  // Already fired: return the same answer rather than sending twice.
  if (existing.length > 0 && existing[0].state !== "staged") {
    const [counts] = await pool.execute(
      `SELECT COUNT(*) AS created FROM alert_messages WHERE alert_id = ?`,
      [alertId]
    );
    return {
      accepted: true,
      created: counts[0].created,
      deduped: 0,
      failed: 0,
      idempotent: true,
    };
  }

  let ciphertext;
  let planHash;

  if (existing.length > 0) {
    ciphertext = existing[0].ciphertext.toString("utf8");
    planHash = existing[0].plan_hash;
  } else if (body.ciphertext) {
    // Staging never completed - the client sent the payload inline instead.
    ciphertext = body.ciphertext;
    planHash = body.planHash || null;
    await pool.execute(
      `INSERT INTO alerts (alert_id, user_id, state, ciphertext, plan_hash, purge_after)
       VALUES (?, ?, 'staged', ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [alertId, actor.userId, ciphertext, planHash, STAGED_TTL_MINUTES]
    );
  } else {
    throw fail(409, "No staged payload; resend with ciphertext");
  }

  const payload = decryptPayload(ciphertext, key, planHash);
  const recipients = expand(payload, location);

  if (recipients.length === 0) throw fail(400, "No recipients in payload");

  const contentHash = hashContent(payload);
  const skip = await dedupeTargets(pool, actor.userId, contentHash, alertId);
  const ceilingRemaining = await remainingDailyAllowance(pool, actor.userId);

  const toSend = recipients
    .filter((r) => !skip.has(r.to))
    .slice(0, Math.max(0, ceilingRemaining));

  const deduped = recipients.length - toSend.length;

  await pool.execute(
    `UPDATE alerts
        SET state = 'fired', enc_key = NULL, ciphertext = NULL,
            content_hash = ?, location_lat = ?, location_lng = ?,
            fired_at = NOW(),
            purge_after = DATE_ADD(NOW(), INTERVAL ? HOUR)
      WHERE alert_id = ?`,
    [
      contentHash,
      location && location.lat != null ? location.lat : null,
      location && location.lng != null ? location.lng : null,
      FIRED_TTL_HOURS,
      alertId,
    ]
  );

  if (toSend.length === 0) {
    await bumpStats(pool, { alerts_fired: 1 });
    return { accepted: true, created: 0, deduped, failed: 0 };
  }

  // Insert the rows and hand every message to Twilio concurrently, so the
  // database round trip is not paid before the first SMS goes out.
  const client = context.getTwilioClient();
  const inserted = insertMessages(pool, alertId, toSend);

  const sends = toSend.map((r) =>
    client.messages
      .create({
        body: r.body,
        to: r.to,
        messagingServiceSid: context.MESSAGING_SERVICE_SID,
        statusCallback: context.ALERT_STATUS_CALLBACK_URL,
      })
      .then((msg) => ({ to: r.to, sid: msg.sid }))
      .catch((err) => ({ to: r.to, error: err && err.message }))
  );

  const [, results] = await Promise.all([inserted, Promise.all(sends)]);

  let created = 0;
  let failed = 0;

  for (const result of results) {
    if (result.sid) {
      created += 1;
      await pool.execute(
        `UPDATE alert_messages
            SET message_sid = ?, status = 'sent', attempts = 1
          WHERE alert_id = ? AND recipient = ?`,
        [result.sid, alertId, result.to]
      );
    } else {
      failed += 1;
      // No SID means Twilio never accepted it, so no status callback will
      // arrive. The sweep picks these up as orphans.
      await pool.execute(
        `UPDATE alert_messages
            SET status = 'pending', attempts = 1, last_error = ?,
                next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
          WHERE alert_id = ? AND recipient = ?`,
        [truncate(result.error), RETRY_LADDER_MINUTES[2], alertId, result.to]
      );
    }
  }

  await bumpStats(pool, { alerts_fired: 1, messages_created: created });

  if (recipients.length > DAILY_MESSAGE_SOFT_ALERT) {
    console.warn(`alert ${alertId}: ${recipients.length} recipients in one alert`);
  }

  return { accepted: true, created, deduped, failed };
}

/* ─────────────────────────── payload handling ───────────────────────── */

/**
 * XChaCha20-Poly1305, matching app/utils/encryption-utils.ts. The envelope is
 * "RN1." followed by base64(nonce || ciphertext || tag).
 */
function decryptPayload(envelope, keyBase64, expectedHash) {
  if (typeof envelope !== "string" || !envelope.startsWith("RN1.")) {
    throw fail(400, "Unrecognised payload format");
  }

  const raw = Buffer.from(envelope.slice(4), "base64");
  const nonce = raw.subarray(0, 24);
  const sealed = raw.subarray(24);
  const key = Buffer.from(keyBase64, "base64");

  if (key.length !== 32 || sealed.length < 17) {
    throw fail(400, "Invalid key or ciphertext");
  }

  let plaintext;
  try {
    const { xchacha20poly1305 } = require("@noble/ciphers/chacha");
    plaintext = Buffer.from(
      xchacha20poly1305(new Uint8Array(key), new Uint8Array(nonce)).decrypt(
        new Uint8Array(sealed)
      )
    ).toString("utf8");
  } catch (e) {
    throw fail(400, "Payload failed authentication");
  }

  if (expectedHash) {
    const actual = crypto.createHash("sha256").update(plaintext).digest("hex");
    if (!constantTimeEquals(actual, expectedHash)) {
      throw fail(400, "Payload hash mismatch");
    }
  }

  try {
    return JSON.parse(plaintext);
  } catch (e) {
    throw fail(400, "Payload is not valid JSON");
  }
}

/** Compose the wire format into one message per recipient. */
function expand(payload, location) {
  const out = [];
  const groups = Array.isArray(payload.groups) ? payload.groups : [];

  for (const group of groups) {
    if (!group || typeof group.body !== "string") continue;
    const to = Array.isArray(group.to) ? group.to : [];
    const names = Array.isArray(group.names) ? group.names : [];

    let text = group.body;

    if (location && location.lat != null && location.lng != null) {
      text += `\n\nCurrent location: https://maps.google.com/?q=${location.lat},${location.lng}`;
    }
    if (names.length > 0) {
      text += `\n\nThis message is sent to following people: ${names.join(", ")}`;
    }
    text += "\n\nReply STOP to opt out of future alerts.";

    for (const number of to) {
      const normalised = normalisePhone(number);
      if (normalised) out.push({ to: normalised, body: text });
    }
  }

  return out;
}

function normalisePhone(input) {
  if (typeof input !== "string") return null;
  let value = input.trim().replace(/[-\s().]/g, "");
  if (!value) return null;
  if (/^\d{10}$/.test(value)) return `+1${value}`;
  if (!value.startsWith("+")) value = `+${value}`;
  return /^\+\d{7,15}$/.test(value) ? value : null;
}

/** Dedupe key over bodies and recipients, deliberately excluding location. */
function hashContent(payload) {
  const groups = (Array.isArray(payload.groups) ? payload.groups : [])
    .map((g) => ({
      body: g && g.body,
      to: Array.isArray(g && g.to) ? [...g.to].sort() : [],
    }))
    .sort((a, b) => String(a.body).localeCompare(String(b.body)));

  return crypto.createHash("sha256").update(JSON.stringify(groups)).digest("hex");
}

/**
 * Recipients who already received this same alert content recently.
 *
 * Deliberately per-recipient rather than per-alert: someone pressing again
 * because it did not work gets a genuine retry for whoever missed out, while
 * contacts who already received it are not messaged twice.
 */
async function dedupeTargets(pool, userId, contentHash, currentAlertId) {
  const [rows] = await pool.execute(
    `SELECT m.recipient
       FROM alerts a
       JOIN alert_messages m ON m.alert_id = a.alert_id
      WHERE a.user_id = ?
        AND a.content_hash = ?
        AND a.alert_id <> ?
        AND a.fired_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
        AND m.status = 'delivered'
        AND m.recipient IS NOT NULL`,
    [userId, contentHash, currentAlertId, DEDUPE_WINDOW_MINUTES]
  );

  return new Set(rows.map((r) => r.recipient));
}

async function remainingDailyAllowance(pool, userId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS sent
       FROM alerts a
       JOIN alert_messages m ON m.alert_id = a.alert_id
      WHERE a.user_id = ? AND a.fired_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [userId]
  );

  // Purge deletes message rows well before the day is out, so this counts
  // roughly the retention window rather than a true 24 hours. Acceptable for a
  // circuit breaker whose job is stopping runaway abuse, not precise metering.
  const used = rows[0] ? Number(rows[0].sent) : 0;
  if (used >= DAILY_MESSAGE_CEILING) {
    console.warn(`user hit daily message ceiling (${used})`);
  }
  return DAILY_MESSAGE_CEILING - used;
}

async function insertMessages(pool, alertId, recipients) {
  const values = recipients.map((r) => [alertId, r.to, r.body]);
  return pool.query(
    `INSERT INTO alert_messages (alert_id, recipient, body) VALUES ?`,
    [values]
  );
}

/* ────────────────────────────────  sweep  ───────────────────────────── */

async function sweep(context, pool) {
  const client = context.getTwilioClient();

  const retried = await retryDue(context, client, pool);
  const orphans = await recoverOrphans(context, client, pool);
  const purged = await purgeBatch(pool, 500);
  const exhausted = await markExhausted(pool);

  await pool.execute(
    `INSERT INTO ops_heartbeat (name, last_run_at) VALUES ('sweep', NOW())
     ON DUPLICATE KEY UPDATE last_run_at = NOW()`
  );

  return { retried, orphans, purged, exhausted };
}

async function retryDue(context, client, pool) {
  const [rows] = await pool.execute(
    `SELECT id, alert_id, recipient, body, attempts
       FROM alert_messages
      WHERE status = 'pending'
        AND recipient IS NOT NULL
        AND next_attempt_at IS NOT NULL
        AND next_attempt_at <= NOW()
        AND attempts < ?
      ORDER BY next_attempt_at
      LIMIT 100
      FOR UPDATE SKIP LOCKED`,
    [MAX_ATTEMPTS]
  );

  return resend(context, client, pool, rows);
}

/**
 * Alerts fired more than five minutes ago with messages Twilio never accepted.
 * No SID means no status callback will ever arrive, so nothing else would
 * notice these - this is the total-outage case.
 */
async function recoverOrphans(context, client, pool) {
  const [rows] = await pool.execute(
    `SELECT m.id, m.alert_id, m.recipient, m.body, m.attempts
       FROM alert_messages m
       JOIN alerts a ON a.alert_id = m.alert_id
      WHERE m.message_sid IS NULL
        AND m.recipient IS NOT NULL
        AND m.status IN ('pending', 'sent')
        AND m.attempts < ?
        AND a.state = 'fired'
        AND a.fired_at <= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      LIMIT 100
      FOR UPDATE SKIP LOCKED`,
    [MAX_ATTEMPTS]
  );

  return resend(context, client, pool, rows);
}

async function resend(context, client, pool, rows) {
  let count = 0;

  for (const row of rows) {
    try {
      const msg = await client.messages.create({
        body: row.body,
        to: row.recipient,
        messagingServiceSid: context.MESSAGING_SERVICE_SID,
        statusCallback: context.ALERT_STATUS_CALLBACK_URL,
      });

      await pool.execute(
        `UPDATE alert_messages
            SET message_sid = ?, status = 'sent', attempts = attempts + 1,
                next_attempt_at = NULL
          WHERE id = ?`,
        [msg.sid, row.id]
      );
      count += 1;
    } catch (err) {
      const attempts = row.attempts + 1;
      const delay =
        RETRY_LADDER_MINUTES[Math.min(attempts, RETRY_LADDER_MINUTES.length - 1)];

      await pool.execute(
        `UPDATE alert_messages
            SET attempts = ?, last_error = ?,
                next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
          WHERE id = ?`,
        [attempts, truncate(err && err.message), delay, row.id]
      );
    }
  }

  return count;
}

async function markExhausted(pool) {
  const [result] = await pool.execute(
    `UPDATE alert_messages
        SET status = 'exhausted'
      WHERE status = 'pending' AND attempts >= ?`,
    [MAX_ATTEMPTS]
  );

  if (result.affectedRows > 0) {
    await bumpStats(pool, { messages_exhausted: result.affectedRows });
    console.error(
      `${result.affectedRows} alert message(s) exhausted all retries and were never delivered`
    );
  }

  return result.affectedRows;
}

/* ───────────────────────────────  purge  ────────────────────────────── */

/**
 * Two stages, both bounded:
 *   1. Clear recipient and body once every message is terminal AND the dedupe
 *      window has passed. The window is why this waits rather than firing the
 *      instant delivery completes.
 *   2. Delete anything past purge_after outright, whatever state it is in.
 */
async function purgeBatch(pool, limit = 100) {
  // Clear plaintext once every message in the alert is terminal AND the dedupe
  // window has passed. The wait is what makes per-recipient dedupe possible.
  await pool.execute(
    `UPDATE alert_messages m
       JOIN alerts a ON a.alert_id = m.alert_id
       JOIN (
         SELECT alert_id,
                SUM(status IN ('pending', 'sent')) AS outstanding
           FROM alert_messages
          GROUP BY alert_id
       ) agg ON agg.alert_id = m.alert_id
        SET m.recipient = NULL, m.body = NULL
      WHERE m.recipient IS NOT NULL
        AND agg.outstanding = 0
        AND a.fired_at IS NOT NULL
        AND a.fired_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [DEDUPE_WINDOW_MINUTES]
  );

  const [result] = await pool.execute(
    `DELETE FROM alerts WHERE purge_after <= NOW() LIMIT ?`,
    [limit]
  );

  return result.affectedRows;
}

/* ────────────────────────────── statistics ──────────────────────────── */

/**
 * Aggregate counters only. No user id, no alert id, no message SIDs, so these
 * rows cannot be used to reconstruct who was contacted.
 */
async function bumpStats(pool, deltas) {
  const columns = Object.keys(deltas);
  if (columns.length === 0) return;

  const insertCols = columns.join(", ");
  const insertVals = columns.map(() => "?").join(", ");
  const updates = columns.map((c) => `${c} = ${c} + VALUES(${c})`).join(", ");

  await pool.execute(
    `INSERT INTO alert_stats_daily (stat_date, ${insertCols})
     VALUES (CURDATE(), ${insertVals})
     ON DUPLICATE KEY UPDATE ${updates}`,
    columns.map((c) => deltas[c])
  );
}

/* ─────────────────────────────── helpers ────────────────────────────── */

function isUuid(value) {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function truncate(value) {
  return value ? String(value).slice(0, 255) : null;
}

module.exports.__test = {
  register,
  expand,
  hashContent,
  normalisePhone,
  decryptPayload,
  constantTimeEquals,
  isUuid,
  RETRY_LADDER_MINUTES,
  DAILY_MESSAGE_CEILING,
};
