import "@bacons/text-decoder/install";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
// import { useColorScheme } from "nativewind";

import { queryClient } from "./utils/api";
import { AppSettingsProvider } from "./utils/app-settings";
import { AuthProvider } from "./utils/use-auth";
import { ModalProvider } from "./context/ModalContext";
import { setupSecureDeepLinkListener, DeepLinkInfo } from "./utils/secure-deep-links";
import { setupSecureRandom } from "./utils/secureRandomInit";

import "../styles.css";
import "../global.css";
import { QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react-native";
import { initializeCrashReportingIfConsented } from "./utils/crash-reporting";

// Crash reporting is opt-in. Sentry is not initialized - no client, no session,
// no network request - unless the user has explicitly agreed to it. The prompt
// is shown right after account creation; see app/utils/crash-reporting.ts.
initializeCrashReportingIfConsented();

// This is the main layout of the app
// It wraps your pages with the providers they need
export default Sentry.wrap(function RootLayout() {
  // const { colorScheme } = useColorScheme();
  
  // Set up security and deep link handling
  useEffect(() => {
    // Initialize secure random first - this is critical for all crypto operations
    try {
      setupSecureRandom();
    } catch (error) {
      console.error("Failed to initialize secure random:", error);
      // Don't throw here as it would crash the app - but log prominently
    }

    // Set up secure deep link handling
    const handleVerifiedDeepLink = (linkInfo: DeepLinkInfo) => {
      // Auth0 will handle its own callbacks automatically
      // Add custom deep link handling logic here if needed
    };

    const subscription = setupSecureDeepLinkListener(handleVerifiedDeepLink);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <AuthProvider>
          <ModalProvider>
          <StatusBar translucent={false} />
            {/*
              The Stack component displays the current page.
              It also allows you to configure your screens 
            */}
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: "#fff",
                },
                headerTintColor: "#000",
                headerBackButtonDisplayMode: "minimal",
                contentStyle: {
                  // backgroundColor: colorScheme == "dark" ? "#09090B" : "#FFFFFF",
                  backgroundColor: "#FFFFFF",
                },
                animation: "slide_from_right",
              }}
            />
          </ModalProvider>
        </AuthProvider>
      </AppSettingsProvider>
    </QueryClientProvider>
  );
});