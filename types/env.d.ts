declare namespace NodeJS {
  interface ProcessEnv {
    // Auth0 Configuration
    EXPO_PUBLIC_AUTH0_DOMAIN?: string;
    EXPO_PUBLIC_AUTH0_CLIENT_ID?: string;
    EXPO_PUBLIC_AUTH0_AUDIENCE?: string;
    EXPO_PUBLIC_AUTH0_CONNECTION?: string;
    EXPO_PUBLIC_AUTH0_REDIRECT_URI?: string;

    // Twilio Configuration
    EXPO_PUBLIC_TWILIO_FUNCTION_URL?: string;

    // MongoDB API Configuration
    EXPO_PUBLIC_MONGODB_API_ENDPOINT?: string;

    // Encryption Configuration
    EXPO_PUBLIC_ENCRYPTION_KEY_NAME?: string;

    //NILRA Twilio Function Configuration
    EXPO_PUBLIC_TWILIO_NILRA_HANDLER_URL?: string;
    EXPO_PUBLIC_TWILIO_COUNTRIES_URL?: string;
    EXPO_PUBLIC_TWILIO_API_SECRET?: string;

    // Push Notification Configuration
    EXPO_PUBLIC_TWILIO_NOTIFICATION_HANDLER_URL?: string;

    // Sentry (crash reporting; opt-in, see app/utils/crash-reporting.ts)
    EXPO_PUBLIC_SENTRY_DSN?: string;

    // Emergency alert delivery (see ALERT-DELIVERY-DESIGN.md)
    EXPO_PUBLIC_ALERT_URL?: string;

    // Node Environment
    NODE_ENV?: 'development' | 'production' | 'test';
  }
} 