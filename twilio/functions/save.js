const mongodb = require('mongodb');
const crypto = require('crypto');

/**
 * Twilio Function: feedback intake.
 *
 * Path: /save
 *
 * Note on what the X-ReadyNow-Key check is and is not.
 *
 * It is a marker that the request came from a ReadyNow build, not
 * authentication. The value ships inside the JS bundle, so anyone willing to
 * unzip an IPA or APK can read it. It raises the cost of abuse from "anyone
 * who has the URL" to "anyone who has unpacked the app", and nothing more.
 * Do not build anything on top of it that assumes a real security boundary.
 *
 * Deliberately NOT an Auth0 token. Feedback is anonymous by design: the client
 * strips userId and phoneNumber before sending (see FeedbackTab.tsx), because
 * feedback about an app used by people facing immigration enforcement should
 * not be attributable to a person. A bearer token would re-identify every
 * submission and undo that.
 *
 * Environment:
 *   MONGODB_URI            - required
 *   TWILIO_API_SECRET      - required once FEEDBACK_REQUIRE_KEY is on
 *   FEEDBACK_REQUIRE_KEY   - optional; set to "true" to reject unmarked
 *                            requests. Leave unset until old installs drain.
 *   ALLOWED_ORIGIN         - optional; only to run the web build in a browser
 *                            during development. Native builds ignore CORS.
 */

// Total feedback text accepted, in characters. Generous for prose, small
// enough that the endpoint is not a free object store. There is no identity to
// rate-limit on here, so the size cap is doing that work instead.
const MAX_FEEDBACK_CHARS = 20000;

/**
 * Constant-time string comparison. Returns false rather than throwing on a
 * length mismatch: crypto.timingSafeEqual requires equal-length buffers, and a
 * rejected request must be a 401, not a 500.
 */
function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function presentedKey(context, event) {
  if (event && typeof event.apiKey === 'string' && event.apiKey) return event.apiKey;
  const headers = (context.request && context.request.headers) || {};
  return headers['x-readynow-key'] || headers['X-ReadyNow-Key'] || null;
}

exports.handler = async function(context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader('Content-Type', 'application/json');

  // No wildcard CORS. Nothing in production is a browser client - React Native
  // does not enforce CORS - and a permissive policy only widened the reach of
  // a secret that ships in the bundle.
  if (context.ALLOWED_ORIGIN) {
    response.appendHeader('Access-Control-Allow-Origin', context.ALLOWED_ORIGIN);
    response.appendHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type, X-ReadyNow-Key');
  }

  // Handle preflight OPTIONS request
  if (event.request && event.request.method === 'OPTIONS') {
    response.setStatusCode(200);
    return callback(null, response);
  }

  let client;

  try {
    // Deliberately not logging the request body. The body previously carried
    // the submitter's phone number and user id straight into the Function log -
    // the only place they ever landed, since both are discarded before the
    // insert below.

    // ── App marker ────────────────────────────────────────────────────────
    // Recorded as a boolean on every document so the share of feedback coming
    // from marked builds is visible. Flip FEEDBACK_REQUIRE_KEY once that share
    // reaches ~100% and old installs have drained. The boolean is not
    // identifying; the key itself is never stored and never logged.
    const expected = context.TWILIO_API_SECRET;
    const presented = presentedKey(context, event);
    const viaAppMarker = Boolean(expected && presented && constantTimeEquals(presented, expected));

    const requireKey = String(context.FEEDBACK_REQUIRE_KEY || '').toLowerCase() === 'true';
    if (requireKey) {
      if (!expected) {
        // Fail closed: a missing config value must never resolve to "allowed".
        console.error('[Feedback] FEEDBACK_REQUIRE_KEY is on but TWILIO_API_SECRET is not set');
        response.setStatusCode(500);
        response.setBody({ success: false, error: 'Service misconfigured' });
        return callback(null, response);
      }
      if (!viaAppMarker) {
        console.warn('[Feedback] Rejected a request with a missing or invalid app marker');
        response.setStatusCode(401);
        response.setBody({ success: false, error: 'Unauthorized' });
        return callback(null, response);
      }
    }

    const uri = context.MONGODB_URI;
    if (!uri) {
      console.error('[Feedback] Missing MONGODB_URI');
      response.setStatusCode(500);
      response.setBody({ success: false, error: 'Service misconfigured' });
      return callback(null, response);
    }

    // Parse feedbackData if it's a string
    let feedbackData;
    try {
      feedbackData = typeof event.feedbackData === 'string'
        ? JSON.parse(event.feedbackData)
        : event.feedbackData;
    } catch (e) {
      console.error('[Feedback] Could not parse feedbackData');
      feedbackData = { error: 'Invalid data format' };
    }

    // Validate that at least one feedback field has content
    const hasContent = feedbackData && Object.values(feedbackData).some(value =>
      typeof value === 'string' && value.trim().length > 0
    );

    if (!hasContent) {
      response.setStatusCode(400);
      response.setBody({ success: false, error: 'No feedback content provided' });
      return callback(null, response);
    }

    const fields = {
      confusing: String(feedbackData.confusing || ''),
      setupTrouble: String(feedbackData.setupTrouble || ''),
      improvements: String(feedbackData.improvements || ''),
      bugReports: String(feedbackData.bugReports || '')
    };

    const totalChars = Object.values(fields).reduce((sum, v) => sum + v.length, 0);
    if (totalChars > MAX_FEEDBACK_CHARS) {
      console.warn('[Feedback] Rejected an oversized submission');
      response.setStatusCode(413);
      response.setBody({ success: false, error: 'Feedback too large' });
      return callback(null, response);
    }

    const dataToSave = {
      timestamp: new Date(event.timestamp || Date.now()),
      feedbackData: fields,
      appLanguage: event.appLanguage || 'en',
      viaAppMarker,
      createdAt: new Date()
    };

    client = new mongodb.MongoClient(uri);
    await client.connect();

    const database = client.db('readynow');
    const collection = database.collection('feedback');
    const result = await collection.insertOne(dataToSave);

    response.setStatusCode(200);
    response.setBody({
      success: true,
      message: 'Feedback saved successfully',
      id: result.insertedId.toString()
    });
    return callback(null, response);
  } catch (error) {
    // Log the detail, return none. error.message here can carry MongoDB
    // connection strings and host names.
    console.error('[Feedback] Failed to save feedback:', error);
    response.setStatusCode(500);
    response.setBody({ success: false, error: 'Failed to save feedback' });
    return callback(null, response);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error('[Feedback] Failed to close the MongoDB connection:', closeError);
      }
    }
  }
};

// Internals exposed for unit tests only. Not part of the Function contract.
exports.__test = {
  constantTimeEquals,
  presentedKey,
  MAX_FEEDBACK_CHARS,
};
