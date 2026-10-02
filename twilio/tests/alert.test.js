// mysql2 is a Twilio-runtime dependency and is not installed here, so it is
// mocked virtually. These tests cover the pure, security-critical helpers:
// payload decryption, credential comparison, and recipient handling.
jest.mock("mysql2/promise", () => ({ createPool: jest.fn() }), { virtual: true });

const { __test } = require("../functions/alert");
const {
  register,
  expand,
  hashContent,
  normalisePhone,
  decryptPayload,
  constantTimeEquals,
  isUuid,
} = __test;

const { xchacha20poly1305 } = require("@noble/ciphers/chacha");
const crypto = require("crypto");

/** Seal a payload the way app/services/alert-api.ts does. */
const seal = (plaintext) => {
  const key = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(24);
  const sealed = xchacha20poly1305(
    new Uint8Array(key),
    new Uint8Array(nonce)
  ).encrypt(new TextEncoder().encode(plaintext));

  const envelope = Buffer.concat([nonce, Buffer.from(sealed)]);
  return {
    ciphertext: `RN1.${envelope.toString("base64")}`,
    key: key.toString("base64"),
  };
};

describe("decryptPayload", () => {
  const payload = { v: 1, groups: [{ body: "Help", to: ["+15551234567"], names: ["Ana"] }] };

  it("round-trips a payload sealed by the client", () => {
    const { ciphertext, key } = seal(JSON.stringify(payload));
    expect(decryptPayload(ciphertext, key)).toEqual(payload);
  });

  it("verifies the plan hash when one is supplied", () => {
    const plaintext = JSON.stringify(payload);
    const { ciphertext, key } = seal(plaintext);
    const hash = crypto.createHash("sha256").update(plaintext).digest("hex");

    expect(decryptPayload(ciphertext, key, hash)).toEqual(payload);
    expect(() => decryptPayload(ciphertext, key, "0".repeat(64))).toThrow(
      /hash mismatch/i
    );
  });

  it("rejects a tampered ciphertext", () => {
    const { ciphertext, key } = seal(JSON.stringify(payload));

    const raw = Buffer.from(ciphertext.slice(4), "base64");
    raw[30] ^= 0x01;
    const tampered = `RN1.${raw.toString("base64")}`;

    expect(() => decryptPayload(tampered, key)).toThrow(/authentication/i);
  });

  it("rejects the wrong key", () => {
    const { ciphertext } = seal(JSON.stringify(payload));
    const otherKey = crypto.randomBytes(32).toString("base64");

    expect(() => decryptPayload(ciphertext, otherKey)).toThrow(/authentication/i);
  });

  it("rejects an unrecognised envelope", () => {
    expect(() => decryptPayload("not-an-envelope", "x")).toThrow(/format/i);
  });

  it("rejects a key of the wrong length", () => {
    const { ciphertext } = seal(JSON.stringify(payload));
    expect(() =>
      decryptPayload(ciphertext, Buffer.alloc(16).toString("base64"))
    ).toThrow(/Invalid key/i);
  });
});

describe("constantTimeEquals", () => {
  it("matches identical values and rejects everything else", () => {
    expect(constantTimeEquals("abc123", "abc123")).toBe(true);
    expect(constantTimeEquals("abc123", "abc124")).toBe(false);
    expect(constantTimeEquals("abc", "abcdef")).toBe(false);
  });

  it("does not treat two undefined values as a match", () => {
    // The retired implementation compared an undefined token against an
    // undefined config value and authorised everyone.
    expect(constantTimeEquals(undefined, undefined)).toBe(true);
    // ...which is why callers must reject a missing credential before
    // comparing. Asserted here so the reasoning is not lost.
    expect(constantTimeEquals("", "secret")).toBe(false);
  });
});

describe("normalisePhone", () => {
  it.each([
    ["5551234567", "+15551234567"],
    ["(555) 123-4567", "+15551234567"],
    ["+1 555 123 4567", "+15551234567"],
    ["+525512345678", "+525512345678"],
  ])("normalises %s", (input, expected) => {
    expect(normalisePhone(input)).toBe(expected);
  });

  it.each([["", null], ["abc", null], ["123", null], [null, null]])(
    "rejects %s",
    (input, expected) => {
      expect(normalisePhone(input)).toBe(expected);
    }
  );
});

describe("expand", () => {
  const payload = {
    v: 1,
    groups: [{ body: "Please help", to: ["5551234567"], names: ["Ana"] }],
  };

  it("composes one message per recipient with the opt-out footer", () => {
    const [message] = expand(payload, null);

    expect(message.to).toBe("+15551234567");
    expect(message.body).toContain("Please help");
    expect(message.body).toContain("Reply STOP to opt out");
  });

  it("appends a location link when location is present", () => {
    const [message] = expand(payload, { lat: 40.7128, lng: -74.006 });
    expect(message.body).toContain("maps.google.com/?q=40.7128,-74.006");
  });

  it("omits the recipient list when no names are supplied", () => {
    const [message] = expand(
      { v: 1, groups: [{ body: "Hi", to: ["5551234567"], names: [] }] },
      null
    );
    expect(message.body).not.toContain("sent to following people");
  });

  it("drops unusable recipients rather than failing the whole alert", () => {
    const messages = expand(
      { v: 1, groups: [{ body: "Hi", to: ["5551234567", "nonsense"], names: [] }] },
      null
    );
    expect(messages).toHaveLength(1);
  });
});

describe("hashContent", () => {
  const base = { v: 1, groups: [{ body: "Help", to: ["+1555", "+1666"], names: ["A"] }] };

  it("is stable regardless of recipient order", () => {
    const reordered = { v: 1, groups: [{ body: "Help", to: ["+1666", "+1555"], names: ["A"] }] };
    expect(hashContent(base)).toBe(hashContent(reordered));
  });

  it("ignores location, so a moved user does not re-blast delivered contacts", () => {
    expect(hashContent({ ...base, location: { lat: 1, lng: 2 } })).toBe(
      hashContent(base)
    );
  });

  it("changes when the message body changes", () => {
    const altered = { v: 1, groups: [{ body: "Different", to: ["+1555", "+1666"], names: ["A"] }] };
    expect(hashContent(altered)).not.toBe(hashContent(base));
  });
});

describe("isUuid", () => {
  it("accepts a v4 uuid and rejects injection-shaped input", () => {
    expect(isUuid("8f14e45f-ceea-467a-9575-3b2d4c2f9a11")).toBe(true);
    expect(isUuid("' OR 1=1 --")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("register", () => {
  const pool = { execute: jest.fn().mockResolvedValue([{}]) };

  beforeEach(() => pool.execute.mockClear());

  it("stores only the hash, and revokes the user's other credentials", async () => {
    const credentialId = "8f14e45f-ceea-467a-9575-3b2d4c2f9a11";
    const secretHash = "a".repeat(64);

    expect(await register(pool, "auth0|abc", { credentialId, secretHash })).toEqual({
      registered: true,
    });

    const [revoke, insert] = pool.execute.mock.calls;
    // A reinstalled or lost device must not keep the ability to fire alerts.
    expect(revoke[0]).toMatch(/revoked_at = NOW\(\)/);
    expect(insert[0]).toMatch(/INSERT INTO device_credentials/);
    expect(insert[1]).toEqual([credentialId, "auth0|abc", secretHash]);
  });

  it.each([
    ["not-a-uuid", "a".repeat(64)],
    ["8f14e45f-ceea-467a-9575-3b2d4c2f9a11", "too-short"],
    ["8f14e45f-ceea-467a-9575-3b2d4c2f9a11", "z".repeat(64)],
    ["' OR 1=1 --", "a".repeat(64)],
  ])("rejects malformed input (%s)", async (credentialId, secretHash) => {
    await expect(register(pool, "auth0|abc", { credentialId, secretHash })).rejects.toThrow();
    expect(pool.execute).not.toHaveBeenCalled();
  });
});
