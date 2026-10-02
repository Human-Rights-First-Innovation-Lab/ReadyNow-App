import * as SecureStore from "expo-secure-store";
import * as Sentry from "@sentry/react-native";
import {
  getCrashReportingConsent,
  setCrashReportingConsent,
  hasAnsweredCrashReportingPrompt,
  initializeCrashReporting,
  initializeCrashReportingIfConsented,
  redactFreeText,
  scrubEvent,
} from "../crash-reporting";

jest.mock("expo-secure-store", () => ({
  getItem: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  close: jest.fn().mockResolvedValue(true),
  getClient: jest.fn(),
  breadcrumbsIntegration: jest.fn((options) => ({
    name: "Breadcrumbs",
    options,
  })),
}));

const CONSENT_KEY = "crash_reporting_consent";

describe("crash reporting consent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sentry.getClient as jest.Mock).mockReturnValue(undefined);
    process.env.EXPO_PUBLIC_SENTRY_DSN = "https://key@example.ingest.sentry.io/1";
  });

  it("defaults to unset when nothing is stored", () => {
    (SecureStore.getItem as jest.Mock).mockReturnValue(null);

    expect(getCrashReportingConsent()).toBe("unset");
    expect(hasAnsweredCrashReportingPrompt()).toBe(false);
  });

  it("treats an unrecognised stored value as unset", () => {
    (SecureStore.getItem as jest.Mock).mockReturnValue("maybe");

    expect(getCrashReportingConsent()).toBe("unset");
  });

  it("fails closed when the store cannot be read", () => {
    (SecureStore.getItem as jest.Mock).mockImplementation(() => {
      throw new Error("keystore unavailable");
    });

    expect(getCrashReportingConsent()).toBe("unset");
  });

  it("reports granted and denied once answered", () => {
    (SecureStore.getItem as jest.Mock).mockReturnValue("granted");
    expect(getCrashReportingConsent()).toBe("granted");
    expect(hasAnsweredCrashReportingPrompt()).toBe(true);

    (SecureStore.getItem as jest.Mock).mockReturnValue("denied");
    expect(getCrashReportingConsent()).toBe("denied");
    expect(hasAnsweredCrashReportingPrompt()).toBe(true);
  });

  it("persists and initializes when consent is granted", async () => {
    await setCrashReportingConsent(true);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(CONSENT_KEY, "granted");
    expect(Sentry.init).toHaveBeenCalled();
  });

  it("persists and does not initialize when consent is refused", async () => {
    await setCrashReportingConsent(false);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(CONSENT_KEY, "denied");
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it("shuts the client down when consent is withdrawn", async () => {
    (Sentry.getClient as jest.Mock).mockReturnValue({});

    await setCrashReportingConsent(false);

    expect(Sentry.close).toHaveBeenCalled();
  });

  describe("startup", () => {
    it.each(["unset", "denied", null])(
      "does not initialize Sentry when consent is %s",
      (stored) => {
        (SecureStore.getItem as jest.Mock).mockReturnValue(stored);

        initializeCrashReportingIfConsented();

        expect(Sentry.init).not.toHaveBeenCalled();
      }
    );

    it("initializes Sentry only when consent was already granted", () => {
      (SecureStore.getItem as jest.Mock).mockReturnValue("granted");

      initializeCrashReportingIfConsented();

      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });

  describe("init options", () => {
    const optionsFromInit = () => {
      initializeCrashReporting();
      return (Sentry.init as jest.Mock).mock.calls[0][0];
    };

    it("disables IP inference and the unused log channel", () => {
      const options = optionsFromInit();

      expect(options.sendDefaultPii).toBe(false);
      expect(options.enableLogs).toBe(false);
    });

    it("disables console breadcrumbs", () => {
      optionsFromInit();

      expect(Sentry.breadcrumbsIntegration).toHaveBeenCalledWith({ console: false });
    });

    it("configures no session replay", () => {
      const options = optionsFromInit();

      expect(options.replaysSessionSampleRate).toBeUndefined();
      expect(options.replaysOnErrorSampleRate).toBeUndefined();
    });

    it("installs the scrubber as beforeSend", () => {
      const options = optionsFromInit();

      expect(options.beforeSend).toBe(scrubEvent);
    });

    it("does not initialize twice", () => {
      initializeCrashReporting();
      (Sentry.getClient as jest.Mock).mockReturnValue({});
      initializeCrashReporting();

      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });

    it("does nothing without a DSN", () => {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;

      initializeCrashReporting();

      expect(Sentry.init).not.toHaveBeenCalled();
    });
  });
});

describe("redactFreeText", () => {
  it.each([
    ["email", "contact me at maria.lopez@example.com now"],
    ["E.164 phone", "reached +15551234567 ok"],
    ["punctuated phone", "called (555) 123-4567 twice"],
    ["A-number", "alien number 847334156 rejected"],
  ])("redacts %s", (_label, input) => {
    const output = redactFreeText(input);

    expect(output).toContain("[redacted]");
    expect(output).not.toMatch(/\d{7,}/);
    expect(output).not.toContain("@example.com");
  });

  it("leaves ordinary diagnostic text alone", () => {
    const input = "NILRA proxy returned status 502";

    expect(redactFreeText(input)).toBe(input);
  });
});

describe("scrubEvent", () => {
  it("removes every identity-bearing top-level field", () => {
    const event = {
      user: { id: "auth0|abc", email: "a@b.com", ip_address: "203.0.113.9" },
      extra: { responseText: '{"firstName":"Maria","alienNumber":"847334156"}' },
      request: { url: "https://x.twil.io/nilra-api", headers: { Cookie: "s=1" } },
      server_name: "device-name",
    } as unknown as Sentry.ErrorEvent;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.server_name).toBeUndefined();
  });

  it("keeps only allowlisted device fields", () => {
    const event = {
      contexts: {
        device: {
          model: "iPhone14,3",
          family: "iPhone",
          name: "Maria's iPhone",
          timezone: "America/New_York",
          device_unique_identifier: "F1B2-C3D4",
          battery_level: 44,
        },
      },
    } as unknown as Sentry.ErrorEvent;

    const device = scrubEvent(event).contexts?.device as Record<string, unknown>;

    expect(device.model).toBe("iPhone14,3");
    expect(device.family).toBe("iPhone");
    expect(device.name).toBeUndefined();
    expect(device.timezone).toBeUndefined();
    expect(device.device_unique_identifier).toBeUndefined();
    expect(device.battery_level).toBeUndefined();
  });

  it("drops the per-install identifier from app context", () => {
    const event = {
      contexts: {
        app: { app_version: "1.2.6", device_app_hash: "9c1f77aa20f4" },
      },
    } as unknown as Sentry.ErrorEvent;

    const app = scrubEvent(event).contexts?.app as Record<string, unknown>;

    expect(app.app_version).toBe("1.2.6");
    expect(app.device_app_hash).toBeUndefined();
  });

  it("drops contexts that are not allowlisted at all", () => {
    const event = {
      contexts: {
        culture: { locale: "es-US", timezone: "America/Phoenix" },
        os: { name: "iOS", version: "17.2" },
      },
    } as unknown as Sentry.ErrorEvent;

    const contexts = scrubEvent(event).contexts as Record<string, unknown>;

    expect(contexts.culture).toBeUndefined();
    expect(contexts.os).toEqual({ name: "iOS", version: "17.2" });
  });

  it("redacts personal data interpolated into an exception message", () => {
    const event = {
      exception: {
        values: [
          { type: "Error", value: "Failed to send to +15551234567 for 847334156" },
        ],
      },
    } as unknown as Sentry.ErrorEvent;

    const value = scrubEvent(event).exception?.values?.[0].value ?? "";

    expect(value).not.toContain("15551234567");
    expect(value).not.toContain("847334156");
    expect(value).toContain("[redacted]");
  });

  it("redacts the top-level message", () => {
    const event = { message: "lookup failed for maria@example.com" } as Sentry.ErrorEvent;

    expect(scrubEvent(event).message).not.toContain("maria@example.com");
  });

  it("removes console breadcrumbs and breadcrumb data", () => {
    const event = {
      breadcrumbs: [
        { category: "console", message: "Error retrieving data for phone 2125550143" },
        { category: "navigation", message: "to /plan", data: { from: "/main" } },
      ],
    } as unknown as Sentry.ErrorEvent;

    const breadcrumbs = scrubEvent(event).breadcrumbs ?? [];

    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0].category).toBe("navigation");
    expect(breadcrumbs[0].data).toBeUndefined();
  });

  it("leaves nothing identifying in a realistic event", () => {
    const event = {
      message: "alert send failed",
      user: { id: "auth0|xyz", email: "maria@example.com", ip_address: "198.51.100.7" },
      extra: { plan: { alienNumber: "847334156", dateOfBirth: "1990-12-25" } },
      request: { url: "https://x.twil.io/send", headers: { Cookie: "abc" } },
      contexts: {
        device: { model: "Pixel 7", name: "Maria's Pixel" },
        culture: { timezone: "America/New_York" },
      },
      exception: {
        values: [{ type: "Error", value: "contact +15551234567 unreachable" }],
      },
      breadcrumbs: [
        { category: "console", message: "phone 2125550143" },
      ],
    } as unknown as Sentry.ErrorEvent;

    const serialized = JSON.stringify(scrubEvent(event));

    for (const secret of [
      "maria@example.com",
      "198.51.100.7",
      "847334156",
      "1990-12-25",
      "15551234567",
      "2125550143",
      "Maria's Pixel",
      "auth0|xyz",
      "Cookie",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
