/**
 * Twilio Function: NILRA API Handler with Handshake
 *
 * Path: /nilra-api
 *
 * Note on logging: this handler must not log request headers, the presented
 * key, or the configured secret - not even a prefix or a length. The secret
 * arrives in X-ReadyNow-Key, so a header dump writes it to the Function log in
 * full, where it persists and is readable by anyone with console access.
 */

const crypto = require('crypto');

/**
 * Constant-time string comparison. Returns false rather than throwing on a
 * length mismatch: crypto.timingSafeEqual requires equal-length buffers, and a
 * rejected request must be a 401, not a 500.
 *
 * Changes nothing on the wire - same header, same secret, same accept/reject
 * outcome for every input. Only the time taken on a mismatch differs, so no
 * client, old or new, can tell the difference.
 */
function constantTimeEquals(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

exports.handler = async function(context, event, callback) {
  const response = new Twilio.Response();
  // No wildcard CORS. Nothing in production is a browser client - React Native
  // does not enforce CORS - and a permissive policy only widened the reach of a
  // secret that ships in the bundle. Set ALLOWED_ORIGIN only to run the web
  // build against this service during development.
  if (context.ALLOWED_ORIGIN) {
    response.appendHeader('Access-Control-Allow-Origin', context.ALLOWED_ORIGIN);
    response.appendHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type, X-ReadyNow-Key');
  }
  response.appendHeader('Content-Type', 'application/json');

  // Handle preflight OPTIONS
  if (event.request && event.request.method === 'OPTIONS') {
    return callback(null, response);
  }

  try {
    console.log('[NILRA Handler] Request received');

    // ========================================
    // STEP 1: GET HEADERS - Try ALL possible ways
    // ========================================
    let requestApiKey = null;

    // Method 1: From context.request.headers (Twilio's actual location!)
    if (context.request && context.request.headers) {
      const headers = context.request.headers;

      // Look for X-ReadyNow-Key (custom header less likely to be filtered)
      requestApiKey = headers['x-readynow-key'] ||
                     headers['X-ReadyNow-Key'] ||
                     headers['X-READYNOW-KEY'];

    }

    // Method 2: From event.request.headers (standard but doesn't work with JSON body)
    if (!requestApiKey && event.request && event.request.headers) {
      const headers = event.request.headers;

      requestApiKey = headers['x-readynow-key'] ||
                     headers['X-ReadyNow-Key'] ||
                     headers['X-READYNOW-KEY'];

    }

    // Method 3: From event directly
    if (!requestApiKey) {
      requestApiKey = event['x-readynow-key'] ||
                     event['X-ReadyNow-Key'] ||
                     event['readyNowKey'];
      console.log('[NILRA Handler] Method 3 (event properties) - Found key:', !!requestApiKey);
    }

    // Method 4: Check if it's in the body (event.auth.apiKey)
    if (!requestApiKey && event.auth && event.auth.apiKey) {
      requestApiKey = event.auth.apiKey;
      console.log('[NILRA Handler] Method 4 (event.auth.apiKey) - Found key:', !!requestApiKey);
    }

    // Method 5: Fallback - check event.apiKey directly
    if (!requestApiKey && event.apiKey) {
      requestApiKey = event.apiKey;
      console.log('[NILRA Handler] Method 5 (event.apiKey) - Found key:', !!requestApiKey);
    }

    // ========================================
    // STEP 2: VALIDATE HANDSHAKE
    // ========================================
    const TWILIO_API_SECRET = context.TWILIO_API_SECRET;

    if (!TWILIO_API_SECRET) {
      console.error('[NILRA Handler] TWILIO_API_SECRET not configured on server');
      response.setStatusCode(500);
      response.setBody({
        title: 'Server configuration error',
        status: 500,
        error: 'Handshake secret not configured on server'
      });
      return callback(null, response);
    }

    // Compare secrets
    if (!requestApiKey) {
      console.error('[NILRA Handler] No API key found in request');
      console.error('[NILRA Handler] Checked: headers, event properties, body');
      response.setStatusCode(401);
      response.setBody({
        title: 'Unauthorized',
        status: 401,
        error: 'Invalid or missing API key - not found in request'
      });
      return callback(null, response);
    }

    if (!constantTimeEquals(requestApiKey, TWILIO_API_SECRET)) {
      console.error('[NILRA Handler] API key mismatch');
      response.setStatusCode(401);
      response.setBody({
        title: 'Unauthorized',
        status: 401,
        error: 'Invalid or missing API key - mismatch'
      });
      return callback(null, response);
    }

    console.log('[NILRA Handler] Handshake validated successfully');

    // ========================================
    // STEP 3: GET NILRA CREDENTIALS
    // ========================================
    const NILRA_API_URL = context.NILRA_API_URL;
    const NILRA_API_KEY = context.NILRA_API_KEY;

    if (!NILRA_API_URL || !NILRA_API_KEY) {
      console.error('[NILRA Handler] NILRA credentials not configured');
      response.setStatusCode(500);
      response.setBody({
        title: 'Server configuration error',
        status: 500,
        error: 'NILRA API credentials not configured'
      });
      return callback(null, response);
    }

    // ========================================
    // STEP 4: PARSE REQUEST BODY
    // ========================================
    const { intakeData, metadata, auth } = event;

    console.log('[NILRA Handler] Body contents:', {
      hasIntakeData: !!intakeData,
      hasMetadata: !!metadata,
      hasAuth: !!auth
    });

    if (!intakeData) {
      console.error('[NILRA Handler] Missing intakeData');
      response.setStatusCode(400);
      response.setBody({
        title: 'Bad request',
        status: 400,
        error: 'intakeData is required'
      });
      return callback(null, response);
    }

    console.log('[NILRA Handler] Metadata:', {
      userId: metadata?.userId || 'unknown',
      phoneNumber: metadata?.phoneNumber ? '***' + metadata.phoneNumber.slice(-4) : 'unknown',
      appLanguage: metadata?.appLanguage || 'unknown'
    });

    // ========================================
    // STEP 5: FORWARD TO NILRA
    // ========================================
    const nilraEndpoint = NILRA_API_URL.endsWith('/')
      ? `${NILRA_API_URL}Intake`
      : `${NILRA_API_URL}/Intake`;

    console.log('[NILRA Handler] Forwarding to NILRA:', nilraEndpoint);

    const axios = require('axios');

    let nilraResponse;
    try {
      nilraResponse = await axios({
        method: 'POST',
        url: nilraEndpoint,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': NILRA_API_KEY
        },
        data: intakeData,
        timeout: 30000,
        validateStatus: (status) => status < 600
      });

      console.log('[NILRA Handler] NILRA response:', nilraResponse.status);
    } catch (axiosError) {
      console.error('[NILRA Handler] Axios error:', axiosError.message);
      response.setStatusCode(500);
      response.setBody({
        title: 'NILRA request failed',
        status: 500,
        error: axiosError.message
      });
      return callback(null, response);
    }

    // ========================================
    // STEP 6: RETURN RESPONSE
    // ========================================
    response.setStatusCode(nilraResponse.status);
    response.setBody(nilraResponse.data);
    return callback(null, response);

  } catch (error) {
    console.error('[NILRA Handler] Exception:', error.message);
    console.error('[NILRA Handler] Stack:', error.stack);

    response.setStatusCode(500);
    response.setBody({
      title: 'Internal server error',
      status: 500,
      error: error.message
    });
    return callback(null, response);
  }
};
