// Both are Twilio-runtime dependencies, not installed here.
jest.mock("mysql2/promise", () => ({ createPool: jest.fn() }), { virtual: true });
jest.mock(
  "expo-server-sdk",
  () => ({
    Expo: class {
      static isExpoPushToken(t) {
        return typeof t === "string" && t.startsWith("ExponentPushToken[");
      }
    },
  }),
  { virtual: true }
);

const { __test } = require("../functions/notification-manager");
const {
  assertConfigured,
  constantTimeEquals,
  presentedSecret,
  resolveLocalizedString,
} = __test;

const validConfig = {
  TWILIO_API_SECRET: "client-secret",
  TWILIO_DISPATCH_SECRET: "server-only-secret",
  DO_MYSQL_HOST: "host",
  DO_MYSQL_USER: "user",
  DO_MYSQL_PASSWORD: "pw",
  DO_MYSQL_DATABASE: "db",
  DO_MYSQL_CA_CERT: "-----BEGIN CERTIFICATE-----",
};

describe("assertConfigured", () => {
  it("accepts a fully configured service", () => {
    expect(() => assertConfigured(validConfig)).not.toThrow();
  });

  it.each([
    "TWILIO_API_SECRET",
    "TWILIO_DISPATCH_SECRET",
    "DO_MYSQL_CA_CERT",
    "DO_MYSQL_PASSWORD",
  ])("fails closed when %s is missing", (key) => {
    // A missing secret must never resolve to "authorised".
    const config = { ...validConfig };
    delete config[key];

    expect(() => assertConfigured(config)).toThrow(new RegExp(key));
  });

  it("keeps configuration detail out of the client-facing message", () => {
    const config = { ...validConfig };
    delete config.DO_MYSQL_HOST;

    try {
      assertConfigured(config);
      throw new Error("expected assertConfigured to throw");
    } catch (err) {
      // Detail is logged; the caller is told nothing about the internals.
      expect(err.message).toMatch(/DO_MYSQL_HOST/);
      expect(err.clientMessage).toBe("Service misconfigured");
      expect(err.statusCode).toBe(500);
    }
  });

  it("refuses to run when both secrets are the same value", () => {
    // Reusing one value would restore the capability the split removes: the
    // credential shipped in every app bundle could broadcast to every device.
    expect(() =>
      assertConfigured({ ...validConfig, TWILIO_DISPATCH_SECRET: "client-secret" })
    ).toThrow(/must differ/i);
    // and the caller still learns nothing useful
    try {
      assertConfigured({ ...validConfig, TWILIO_DISPATCH_SECRET: "client-secret" });
    } catch (err) {
      expect(err.clientMessage).toBe("Service misconfigured");
    }
  });

  it("requires the CA certificate, leaving no unverified-TLS path", () => {
    // The retired implementation fell back to rejectUnauthorized:false when
    // this was unset, silently downgrading to an unverified connection.
    const config = { ...validConfig };
    delete config.DO_MYSQL_CA_CERT;
    expect(() => assertConfigured(config)).toThrow(/DO_MYSQL_CA_CERT/);
  });
});

describe("constantTimeEquals", () => {
  it("matches identical secrets", () => {
    expect(constantTimeEquals("abc123", "abc123")).toBe(true);
  });

  it.each([
    ["abc123", "abc124"],
    ["abc", "abcdef"],
    ["", "secret"],
  ])("rejects %s vs %s", (a, b) => {
    expect(constantTimeEquals(a, b)).toBe(false);
  });

  it("rejects non-strings rather than treating them as equal", () => {
    // undefined === undefined would have authorised everyone.
    expect(constantTimeEquals(undefined, undefined)).toBe(false);
    expect(constantTimeEquals(null, null)).toBe(false);
    expect(constantTimeEquals("secret", undefined)).toBe(false);
  });
});

describe("presentedSecret", () => {
  it("reads the x-api-key header", () => {
    const event = { request: { headers: { "x-api-key": " k " } } };
    expect(presentedSecret(event, {})).toBe("k");
  });

  it("reads a headers.get() style header", () => {
    const event = {
      request: { headers: { get: (n) => (n === "x-api-key" ? "k" : null) } },
    };
    expect(presentedSecret(event, {})).toBe("k");
  });

  it.each([
    [{ apiKey: "k" }],
    [{ api_key: "k" }],
    [{ auth: { apiKey: "k" } }],
    [{ payload: { apiKey: "k" } }],
  ])("still accepts the historical body form %j", (body) => {
    // Existing clients send the secret in the body; changing that would break
    // installs that cannot be updated.
    expect(presentedSecret({}, body)).toBe("k");
  });

  it("returns an empty string when nothing is presented", () => {
    expect(presentedSecret({}, {})).toBe("");
  });
});

describe("resolveLocalizedString", () => {
  it("prefers English, falls back to any string, then to the default", () => {
    expect(resolveLocalizedString({ en: "Hello", es: "Hola" }, "x")).toBe("Hello");
    expect(resolveLocalizedString({ es: "Hola" }, "x")).toBe("Hola");
    expect(resolveLocalizedString("Plain", "x")).toBe("Plain");
    expect(resolveLocalizedString(null, "x")).toBe("x");
    expect(resolveLocalizedString({}, "x")).toBe("x");
  });
});
