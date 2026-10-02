// mongodb is a Twilio-runtime dependency, not installed here.
const mockInsertOne = jest.fn();
const mockConnect = jest.fn();
const mockClose = jest.fn();

jest.mock(
  "mongodb",
  () => ({
    MongoClient: class {
      connect() {
        return mockConnect();
      }
      db() {
        return { collection: () => ({ insertOne: mockInsertOne }) };
      }
      close() {
        return mockClose();
      }
    },
  }),
  { virtual: true }
);

const { handler, __test } = require("../functions/save");
const { constantTimeEquals, presentedKey, MAX_FEEDBACK_CHARS } = __test;

// Minimal stand-in for the Twilio runtime's Response object.
class FakeResponse {
  constructor() {
    this.headers = {};
    this.statusCode = 200;
    this.body = undefined;
  }
  appendHeader(k, v) {
    this.headers[k] = v;
  }
  setStatusCode(c) {
    this.statusCode = c;
  }
  setBody(b) {
    this.body = b;
  }
}

beforeAll(() => {
  global.Twilio = { Response: FakeResponse };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockInsertOne.mockResolvedValue({ insertedId: { toString: () => "abc123" } });
  mockConnect.mockResolvedValue(undefined);
  mockClose.mockResolvedValue(undefined);
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const SECRET = "shipped-in-the-bundle";

const baseContext = {
  MONGODB_URI: "mongodb://example",
  TWILIO_API_SECRET: SECRET,
};

const goodFeedback = {
  timestamp: 1700000000000,
  appLanguage: "es",
  feedbackData: { confusing: "the setup screen", setupTrouble: "", improvements: "", bugReports: "" },
};

function run(context, event) {
  return new Promise((resolve) => {
    handler(context, event, (_err, response) => resolve(response));
  });
}

describe("constantTimeEquals", () => {
  it("matches identical strings", () => {
    expect(constantTimeEquals(SECRET, SECRET)).toBe(true);
  });

  it("rejects a different value of the same length", () => {
    expect(constantTimeEquals("aaaa", "bbbb")).toBe(false);
  });

  // crypto.timingSafeEqual throws on unequal-length buffers. A rejected
  // request must be a 401, never a 500.
  it("returns false rather than throwing on a length mismatch", () => {
    expect(() => constantTimeEquals("short", "a-much-longer-secret")).not.toThrow();
    expect(constantTimeEquals("short", "a-much-longer-secret")).toBe(false);
  });

  it("handles undefined without throwing", () => {
    expect(constantTimeEquals(undefined, SECRET)).toBe(false);
  });
});

describe("presentedKey", () => {
  it("reads the key from the body", () => {
    expect(presentedKey({}, { apiKey: SECRET })).toBe(SECRET);
  });

  it("falls back to the header", () => {
    const ctx = { request: { headers: { "x-readynow-key": SECRET } } };
    expect(presentedKey(ctx, {})).toBe(SECRET);
  });

  it("returns null when absent", () => {
    expect(presentedKey({}, {})).toBeNull();
  });
});

describe("CORS", () => {
  it("sends no Access-Control-Allow-Origin by default", async () => {
    const res = await run(baseContext, goodFeedback);
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("never sends a wildcard origin", async () => {
    const res = await run({ ...baseContext, ALLOWED_ORIGIN: "http://localhost:8081" }, goodFeedback);
    expect(res.headers["Access-Control-Allow-Origin"]).toBe("http://localhost:8081");
  });
});

describe("app marker, before enforcement", () => {
  it("accepts an unmarked request and records viaAppMarker false", async () => {
    const res = await run(baseContext, goodFeedback);

    expect(res.statusCode).toBe(200);
    expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({ viaAppMarker: false }));
  });

  it("accepts a marked request and records viaAppMarker true", async () => {
    const res = await run(baseContext, { ...goodFeedback, apiKey: SECRET });

    expect(res.statusCode).toBe(200);
    expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({ viaAppMarker: true }));
  });

  it("records viaAppMarker false for a wrong key rather than rejecting", async () => {
    const res = await run(baseContext, { ...goodFeedback, apiKey: "wrong" });

    expect(res.statusCode).toBe(200);
    expect(mockInsertOne).toHaveBeenCalledWith(expect.objectContaining({ viaAppMarker: false }));
  });

  it("never stores the key itself", async () => {
    await run(baseContext, { ...goodFeedback, apiKey: SECRET });

    const stored = JSON.stringify(mockInsertOne.mock.calls[0][0]);
    expect(stored).not.toContain(SECRET);
  });
});

describe("app marker, once FEEDBACK_REQUIRE_KEY is on", () => {
  const enforcing = { ...baseContext, FEEDBACK_REQUIRE_KEY: "true" };

  it("accepts a correctly marked request", async () => {
    const res = await run(enforcing, { ...goodFeedback, apiKey: SECRET });
    expect(res.statusCode).toBe(200);
  });

  it("rejects an unmarked request", async () => {
    const res = await run(enforcing, goodFeedback);

    expect(res.statusCode).toBe(401);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it("fails closed when the secret is not configured", async () => {
    const config = { ...enforcing };
    delete config.TWILIO_API_SECRET;

    const res = await run(config, { ...goodFeedback, apiKey: SECRET });

    expect(res.statusCode).toBe(500);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });
});

describe("input handling", () => {
  it("rejects a submission with no content", async () => {
    const res = await run(baseContext, {
      ...goodFeedback,
      feedbackData: { confusing: "   ", setupTrouble: "", improvements: "", bugReports: "" },
    });

    expect(res.statusCode).toBe(400);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it("rejects an oversized submission", async () => {
    const res = await run(baseContext, {
      ...goodFeedback,
      feedbackData: { confusing: "x".repeat(MAX_FEEDBACK_CHARS + 1), setupTrouble: "", improvements: "", bugReports: "" },
    });

    expect(res.statusCode).toBe(413);
    expect(mockInsertOne).not.toHaveBeenCalled();
  });

  it("stores only the four known fields, dropping anything else sent", async () => {
    await run(baseContext, {
      ...goodFeedback,
      feedbackData: { ...goodFeedback.feedbackData, phoneNumber: "+15551234567", userId: "auth0|abc" },
    });

    const stored = mockInsertOne.mock.calls[0][0];
    expect(Object.keys(stored.feedbackData).sort()).toEqual([
      "bugReports",
      "confusing",
      "improvements",
      "setupTrouble",
    ]);
    expect(JSON.stringify(stored)).not.toContain("+15551234567");
  });
});

describe("failure handling", () => {
  it("keeps upstream error detail out of the response body", async () => {
    mockInsertOne.mockRejectedValue(new Error("mockConnect ECONNREFUSED mongodb://user:pw@cluster.example"));

    const res = await run(baseContext, goodFeedback);

    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("cluster.example");
    expect(res.body.error).toBe("Failed to save feedback");
  });

  it("closes the connection even when the insert fails", async () => {
    mockInsertOne.mockRejectedValue(new Error("boom"));

    await run(baseContext, goodFeedback);

    expect(mockClose).toHaveBeenCalled();
  });
});
