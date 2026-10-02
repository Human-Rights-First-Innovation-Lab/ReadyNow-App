import React, { useEffect, useRef } from "react";
import { Platform, Alert, AppState, AppStateStatus } from "react-native";

/**
 * Hook to detect potential overlay attacks on Android
 * Monitors app state changes that might indicate overlay
 */
export const useOverlayProtection = (onOverlayDetected?: () => void) => {
  const appState = useRef(AppState.currentState);
  const suspiciousTransitionCount = useRef(0);
  const lastTransitionTime = useRef(Date.now());

  useEffect(() => {
    // Only needed for Android < 10
    if (Platform.OS !== "android" || Platform.Version >= 29) {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      const now = Date.now();
      const timeSinceLastTransition = now - lastTransitionTime.current;

      // Detect rapid foreground/background transitions (potential overlay)
      if (
        appState.current === "active" &&
        nextAppState === "background" &&
        timeSinceLastTransition < 100 // Less than 100ms
      ) {
        suspiciousTransitionCount.current++;

        if (suspiciousTransitionCount.current > 2) {
          // Potential overlay attack detected
          handlePotentialOverlay();
          suspiciousTransitionCount.current = 0;
        }
      }

      // Reset counter after some time
      if (timeSinceLastTransition > 5000) {
        suspiciousTransitionCount.current = 0;
      }

      appState.current = nextAppState;
      lastTransitionTime.current = now;
    };

    const handlePotentialOverlay = () => {
      if (onOverlayDetected) {
        onOverlayDetected();
      } else {
        Alert.alert(
          "⚠️ Security Alert",
          "For your security, please close all other apps and restart ReadyNow.",
          [
            {
              text: "OK",
              onPress: () => {
                // User should manually restart the app
              },
            },
          ],
          { cancelable: false }
        );
      }
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [onOverlayDetected]);
};

/**
 * Component wrapper that adds overlay protection to sensitive screens
 */
export function withOverlayProtection<P extends object>(
  Component: React.ComponentType<P>,
  screenName: string = "Screen"
): React.ComponentType<P> {
  return function ProtectedComponent(props: P) {
    useOverlayProtection(() => {
      console.warn(`Potential overlay detected on ${screenName}`);
    });

    return React.createElement(Component, props);
  };
}

/**
 * Check if the app might be under overlay attack
 * This is a best-effort check for React Native
 */
export const checkForSuspiciousOverlay = (): boolean => {
  if (Platform.OS !== "android" || Platform.Version >= 29) {
    return false; // Not vulnerable
  }

  // Additional checks can be implemented here
  // For now, we rely on the app state monitoring
  return false;
};

/**
 * Security best practices for sensitive screens
 */
export const securityRecommendations = {
  // For login/auth screens
  auth: {
    disableScreenshots: true,
    preventOverlay: true,
    singleInstance: true,
  },
  
  // For emergency plan screens
  sensitiveData: {
    disableScreenshots: true,
    preventOverlay: true,
    requireBiometric: true,
  },
  
  // For general screens
  general: {
    disableScreenshots: false,
    preventOverlay: true,
    singleInstance: false,
  },
}; 

export default {
  useOverlayProtection,
  withOverlayProtection,
  checkForSuspiciousOverlay,
  securityRecommendations,
};