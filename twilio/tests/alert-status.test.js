jest.mock("mysql2/promise", () => ({ createPool: jest.fn() }), { virtual: true });

const twilio = require("twilio");
const { __test } = require("../functions/alert-status");
const { isFromTwilio, TERMINAL_ERROR_CODES, OPTOUT_ERROR_CODE } = __test;

const AUTH_TOKEN = "test-auth-token";
const URL = "https://example.twil.io/alert-status";

const signedEvent = (params, token = AUTH_TOKEN) => {
  const signature = twilio.getExpectedTwilioSignature(token, URL, params);
  return {
    ...params,
    request: { headers: { "x-twilio-signature": signature } },
  };
};

describe("isFromTwilio", () => {
  const context = { AUTH_TOKEN, ALERT_STATUS_CALLBACK_URL: URL };
  const params = { MessageSid: "SM123", MessageStatus: "delivered" };

  it("accepts a correctly signed request", () => {
    expect(isFromTwilio(context, signedEvent(params))).toBe(true);
  });

  it("rejects a forged delivery confirmation", () => {
    // Without this, anyone knowing the URL could mark a message delivered and
    // suppress the retries for an alert that never arrived.
    const forged = { ...params, request: { headers: { "x-twilio-signature": "bogus" } } };
    expect(isFromTwilio(context, forged)).toBe(false);
  });

  it("rejects a request signed with the wrong token", () => {
    expect(isFromTwilio(context, signedEvent(params, "other-token"))).toBe(false);
  });

  it("rejects a request whose parameters were altered after signing", () => {
    const event = signedEvent(params);
    event.MessageStatus = "delivered-but-not-really";
    expect(isFromTwilio(context, event)).toBe(false);
  });

  it("rejects when no signature is present", () => {
    expect(isFromTwilio(context, params)).toBe(false);
  });

  it("fails closed when the auth token is not configured", () => {
    expect(isFromTwilio({ ALERT_STATUS_CALLBACK_URL: URL }, signedEvent(params))).toBe(false);
  });
});

describe("error classification", () => {
  it("treats an opt-out as its own outcome, not a delivery fault", () => {
    // Honoured permanently and never surfaced to the user; counted separately
    // so it does not look like a failure in monitoring.
    expect(OPTOUT_ERROR_CODE).toBe(21610);
    expect(TERMINAL_ERROR_CODES.has(OPTOUT_ERROR_CODE)).toBe(false);
  });

  it("marks unreachable-number errors terminal", () => {
    for (const code of [21211, 21614, 30005]) {
      expect(TERMINAL_ERROR_CODES.has(code)).toBe(true);
    }
  });

  it("leaves transient errors retryable", () => {
    for (const code of [30001, 30003, 30004]) {
      expect(TERMINAL_ERROR_CODES.has(code)).toBe(false);
    }
  });
});
