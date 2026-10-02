const axios = require('axios');

/**
 * Twilio Function to fetch countries list from NILRA API.
 * This function acts as a proxy to keep the NILRA API credentials secure.
 *
 * Path: /countries
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
    response.appendHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.appendHeader('Access-Control-Allow-Headers', 'Content-Type, X-ReadyNow-Key');
  }
  response.appendHeader('Content-Type', 'application/json');

  // Handle preflight OPTIONS
  if (event.request && event.request.method === 'OPTIONS') {
    return callback(null, response);
  }

  try {
    console.log('[Countries Handler] Request received');

    // ========================================
    // STEP 1: VALIDATE HANDSHAKE
    // ========================================
    let requestApiKey = null;

    // Try to get API key from body (most reliable for React Native)
    if (event.apiKey) {
      requestApiKey = event.apiKey;
      console.log('[Countries Handler] Found API key in body');
    }

    // Fallback: try headers
    if (!requestApiKey && context.request && context.request.headers) {
      const headers = context.request.headers;
      requestApiKey = headers['x-readynow-key'] ||
                     headers['X-ReadyNow-Key'] ||
                     headers['X-READYNOW-KEY'];
      console.log('[Countries Handler] Found API key in headers:', !!requestApiKey);
    }

    const serverApiKey = context.TWILIO_API_SECRET;
    console.log('[Countries Handler] Server secret configured:', !!serverApiKey);

    if (!requestApiKey || !constantTimeEquals(requestApiKey, serverApiKey)) {
      console.error('[Countries Handler] Invalid or missing API key');
      response.setStatusCode(401);
      response.setBody({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      });
      return callback(null, response);
    }
    console.log('[Countries Handler] Handshake validated successfully');

    // ========================================
    // STEP 2: VALIDATE NILRA API CREDENTIALS
    // ========================================
    // No default. This previously fell back to NILRA's *test* host, so a
    // missing or misspelled variable sent production traffic there and looked
    // like it was working. Fail closed instead, as the key check below already
    // does.
    const NILRA_COUNTRIES_URL = context.NILRA_COUNTRIES_URL;
    const NILRA_API_KEY = context.NILRA_API_KEY;

    if (!NILRA_COUNTRIES_URL || !NILRA_API_KEY) {
      console.error('[Countries Handler] NILRA API configuration missing');
      response.setStatusCode(500);
      response.setBody({
        error: 'Internal server error',
        message: 'NILRA API credentials not configured'
      });
      return callback(null, response);
    }

    // ========================================
    // STEP 3: FETCH COUNTRIES FROM NILRA API
    // ========================================
    console.log('[Countries Handler] Fetching countries from NILRA API...');

    const nilraResponse = await axios.get(NILRA_COUNTRIES_URL, {
      headers: {
        'X-Api-Key': NILRA_API_KEY,
      },
      timeout: 10000 // 10 seconds timeout
    });

    console.log('[Countries Handler] Countries fetched successfully');
    console.debug('[Countries Handler] Response status:', nilraResponse.status);
    console.debug('[Countries Handler] Countries count:', nilraResponse.data?.length || 0);

    response.setStatusCode(200);
    response.setBody({
      countries: nilraResponse.data,
      count: nilraResponse.data?.length || 0
    });
    return callback(null, response);

  } catch (error) {
    console.error('[Countries Handler] Exception during API call:', error);

    let errorMessage = 'An unknown error occurred';
    let statusCode = 500;
    let errorDetails = {};

    if (axios.isAxiosError(error)) {
      errorMessage = error.response?.data?.title || error.message;
      statusCode = error.response?.status || 500;
      errorDetails = {
        axiosStatus: error.response?.status,
        axiosData: error.response?.data,
        axiosMessage: error.message
      };
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    console.error('[Countries Handler] Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : 'No stack trace',
      ...errorDetails
    });

    response.setStatusCode(statusCode);
    response.setBody({
      error: 'Failed to fetch countries',
      message: errorMessage
    });
    return callback(null, response);
  }
};
