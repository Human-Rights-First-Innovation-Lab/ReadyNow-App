/* eslint-disable no-undef */
const mysql = require("mysql2/promise");

/**
 * Twilio StatusCallback receiver for emergency alerts.
 * See ALERT-DELIVERY-DESIGN.md §8.
 *
 * This is where delivery is actually confirmed. `messages.create` resolving
 * only means Twilio accepted the request; the retired implementation treated
 * that as success, which is why an alert could be reported as sent when every
 * message had failed.
 *
 * Each invocation is also a free wake-up, so it does three other things:
 *   - retries this message immediately if it failed for a transient reason
 *   - retries sibling messages Twilio never accepted, so a partial outage
 *     self-heals without waiting for the sweep
 *   - purges a small batch of expired records
 *
 * Requests are authenticated by Twilio's request signature. Without that check
 * anyone who learned this URL could forge a "delivered" callback to suppress
 * retries for an alert that never arrived, or drive repeated re-sends.
 *
 * Required environment: MESSAGING_SERVICE_SID, ALERT_STATUS_CALLBACK_URL,
 * AUTH_TOKEN (Twilio account token, used for signature validation),
 * DO_MYSQL_* (including DO_MYSQL_CA_CERT).
 */

const DEDUPE_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 6;
const RETRY_LADDER_MINUTES = [0, 0, 5, 20, 60, 120];

// Retrying cannot help these.
const TERMINAL_ERROR_CODES = new Set([
  21211, // invalid To number
  21214, // To number is not a valid mobile
  21614, // not SMS-capable
  30005, // unknown destination handset
  30006, // landline or unreachable carrier
]);

// The recipient replied STOP. Honoured permanently and never surfaced to the
// user: the number is used only by this app, so an opt-out is a deliberate
// choice about these messages, and raising it at the moment of arrest would be
// noise at the point someone can least act on it. Counted separately so an
// honoured opt-out is not mistaken for a delivery fault.
const OPTOUT_ERROR_CODE = 21610;

exports.handler = async function handler(context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader("Content-Type", "application/json");

  let pool;

  try {
    assertConfigured(context);

    if (!isFromTwilio(context, event)) {
      console.error("alert-status: rejected request with an invalid signature");
      response.setStatusCode(403);
      response.setBody(JSON.stringify({ success: false }));
      return callback(null, response);
    }

    const sid = event.MessageSid || event.SmsSid;
    const status = String(event.MessageStatus || event.SmsStatus || "");
    const errorCode = event.ErrorCode ? Number(event.ErrorCode) : null;

    if (!sid) {
      response.setStatusCode(400);
      response.setBody(JSON.stringify({ success: false }));
      return callback(null, response);
    }

    pool = await createConnectionPool(context);

    const [rows] = await pool.execute(
      `SELECT id, alert_id, recipient, body, attempts, status
         FROM alert_messages WHERE message_sid = ?`,
      [sid]
    );

    // Unknown SID: most likely a callback for a record we have already purged.
    if (rows.length === 0) {
      response.setStatusCode(200);
      response.setBody(JSON.stringify({ success: true, known: false }));
      return callback(null, response);
    }

    const message = rows[0];

    if (status === "delivered") {
      await settle(pool, message.id, "delivered", { messages_delivered: 1 });
    } else if (status === "failed" || status === "undelivered") {
      await handleFailure(context, pool, message, errorCode);
    }
    // queued/sending/sent are in-flight; nothing to do.

    await healSiblings(context, pool, message.alert_id);
    await completeAlertIfDone(pool, message.alert_id);
    await purgeBatch(pool);

    response.setStatusCode(200);
    response.setBody(JSON.stringify({ success: true }));
    return callback(null, response);
  } catch (err) {
    console.error(`alert-status error: ${err && err.message}`);
    response.setStatusCode(500);
    response.setBody(JSON.stringify({ success: false, error: "Internal error" }));
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

async function handleFailure(context, pool, message, errorCode) {
  if (errorCode === OPTOUT_ERROR_CODE) {
    await settle(pool, message.id, "optout", { messages_optout: 1 });
    return;
  }

  if (errorCode !== null && TERMINAL_ERROR_CODES.has(errorCode)) {
    await settle(pool, message.id, "failed", { messages_failed: 1 }, errorCode);
    return;
  }

  // Transient. Attempt 2 of the ladder is an immediate re-create - no
  // scheduler is involved, so this is the fastest rung available.
  const attempts = message.attempts + 1;

  if (attempts >= MAX_ATTEMPTS || !message.recipient) {
    await settle(pool, message.id, "exhausted", { messages_exhausted: 1 }, errorCode);
    console.error(
      `alert ${message.alert_id}: a message exhausted all retries and was never delivered`
    );
    return;
  }

  try {
    const client = context.getTwilioClient();
    const resent = await client.messages.create({
      body: message.body,
      to: message.recipient,
      messagingServiceSid: context.MESSAGING_SERVICE_SID,
      statusCallback: context.ALERT_STATUS_CALLBACK_URL,
    });

    await pool.execute(
      `UPDATE alert_messages
          SET message_sid = ?, status = 'sent', attempts = ?,
              next_attempt_at = NULL, last_error = ?
        WHERE id = ?`,
      [resent.sid, attempts, errorCode ? `code ${errorCode}` : null, message.id]
    );
  } catch (err) {
    // Hand it to the ladder for the sweep to pick up.
    const delay =
      RETRY_LADDER_MINUTES[Math.min(attempts, RETRY_LADDER_MINUTES.length - 1)];

    await pool.execute(
      `UPDATE alert_messages
          SET status = 'pending', attempts = ?, last_error = ?,
              next_attempt_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
        WHERE id = ?`,
      [attempts, truncate(err && err.message), delay, message.id]
    );
  }
}

/**
 * Retry siblings in the same alert that Twilio never accepted. Without this
 * they would wait for the sweep, because a message with no SID never produces
 * a callback of its own.
 */
async function healSiblings(context, pool, alertId) {
  const [rows] = await pool.execute(
    `SELECT id, recipient, body, attempts
       FROM alert_messages
      WHERE alert_id = ?
        AND message_sid IS NULL
        AND recipient IS NOT NULL
        AND status = 'pending'
        AND attempts < ?
      LIMIT 25`,
    [alertId, MAX_ATTEMPTS]
  );

  if (rows.length === 0) return;

  const client = context.getTwilioClient();

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
}

async function settle(pool, id, status, statDeltas, errorCode) {
  await pool.execute(
    `UPDATE alert_messages
        SET status = ?, next_attempt_at = NULL, last_error = ?
      WHERE id = ?`,
    [status, errorCode ? `code ${errorCode}` : null, id]
  );
  await bumpStats(pool, statDeltas);
}

async function completeAlertIfDone(pool, alertId) {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS outstanding
       FROM alert_messages
      WHERE alert_id = ? AND status IN ('pending', 'sent')`,
    [alertId]
  );

  if (rows[0].outstanding > 0) return;

  await pool.execute(
    `UPDATE alerts SET state = 'complete', completed_at = NOW()
      WHERE alert_id = ? AND state = 'fired'`,
    [alertId]
  );
}

/**
 * Clear plaintext once everything is terminal AND the dedupe window has
 * passed, then delete anything past its hard purge deadline.
 */
async function purgeBatch(pool) {
  await pool.execute(
    `UPDATE alert_messages m
       JOIN alerts a ON a.alert_id = m.alert_id
        SET m.recipient = NULL, m.body = NULL
      WHERE m.recipient IS NOT NULL
        AND a.state IN ('complete', 'exhausted')
        AND a.fired_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [DEDUPE_WINDOW_MINUTES]
  );

  await pool.execute(`DELETE FROM alerts WHERE purge_after <= NOW() LIMIT 50`);
}

async function bumpStats(pool, deltas) {
  const columns = Object.keys(deltas || {});
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

/**
 * Validate Twilio's request signature.
 *
 * Fails closed: a missing auth token or signature is a rejection, never a
 * pass. The console also offers a "Check for valid Twilio signature" toggle,
 * but relying on a setting nobody can see in code is how the retired alert
 * function ended up authorising everyone.
 */
function isFromTwilio(context, event) {
  const signature =
    (event.request &&
      event.request.headers &&
      (event.request.headers["x-twilio-signature"] ||
        (typeof event.request.headers.get === "function" &&
          event.request.headers.get("x-twilio-signature")))) ||
    (event.headers && event.headers["x-twilio-signature"]);

  if (!signature || !context.AUTH_TOKEN) return false;

  // Twilio signs over the callback URL plus the POST parameters, so the
  // Twilio-injected keys must be stripped before validating.
  const params = {};
  for (const [key, value] of Object.entries(event)) {
    if (key !== "request" && key !== "headers" && key !== "cookies") {
      params[key] = value;
    }
  }

  try {
    const twilio = require("twilio");
    return twilio.validateRequest(
      context.AUTH_TOKEN,
      signature,
      context.ALERT_STATUS_CALLBACK_URL,
      params
    );
  } catch (err) {
    console.error(`signature validation failed: ${err && err.message}`);
    return false;
  }
}

function assertConfigured(context) {
  const required = [
    "MESSAGING_SERVICE_SID",
    "ALERT_STATUS_CALLBACK_URL",
    "AUTH_TOKEN",
    "DO_MYSQL_HOST",
    "DO_MYSQL_USER",
    "DO_MYSQL_PASSWORD",
    "DO_MYSQL_DATABASE",
  ];

  const missing = required.filter((key) => !context[key]);
  if (!readCaCert(context)) missing.push('DO_MYSQL_CA_CERT');
  if (missing.length > 0) {
    throw new Error(`missing config: ${missing.join(", ")}`);
  }
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
    // Certificate verification is mandatory; no unverified fallback.
    ssl: { ca: readCaCert(context), rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });
}

function truncate(value) {
  return value ? String(value).slice(0, 255) : null;
}

module.exports.__test = {
  isFromTwilio,
  TERMINAL_ERROR_CODES,
  OPTOUT_ERROR_CODE,
  RETRY_LADDER_MINUTES,
  MAX_ATTEMPTS,
};
