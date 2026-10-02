import * as Location from "expo-location";
import { Platform, Alert, Linking } from "react-native";

/**
 * Permission utilities for the ReadyNow app
 * Handles runtime permissions with security best practices
 */

export interface PermissionResult {
  granted: boolean;
  canAskAgain?: boolean;
}

/**
 * Location permission rationale for users
 */
const LOCATION_RATIONALE = {
  title: "Location Access for Emergency Alerts",
  message: "ReadyNow needs location access to share your location during emergencies. This helps emergency services find you quickly. Location is only accessed when you send an alert.",
  denial: "Without location access, your emergency alerts won't include your location. This may delay help reaching you."
};

/**
 * Request location permission with proper explanation
 */
export const requestLocationPermission = async (): Promise<PermissionResult> => {
  try {
    // First check current status
    const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
    
    if (existingStatus === Location.PermissionStatus.GRANTED) {
      return { granted: true };
    }
    
    // If denied and can't ask again, show settings prompt
    if (existingStatus === Location.PermissionStatus.DENIED && Platform.OS === "ios") {
      Alert.alert(
        LOCATION_RATIONALE.title,
        LOCATION_RATIONALE.denial + "\n\nWould you like to open settings to enable location access?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]
      );
      return { granted: false, canAskAgain: false };
    }
    
    // Request permission with system dialog
    const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== Location.PermissionStatus.GRANTED) {
      // Show explanation of why permission is important
      Alert.alert(
        "Location Access Recommended",
        LOCATION_RATIONALE.denial,
        [{ text: "OK" }]
      );
    }
    
    return { 
      granted: status === Location.PermissionStatus.GRANTED,
      canAskAgain: canAskAgain ?? true
    };
  } catch (error) {
    console.error("Error requesting location permission:", error);
    return { granted: false, canAskAgain: false };
  }
};

/**
 * Get current location with proper error handling
 */
export const getCurrentLocation = async (options?: {
  timeout?: number;
  highAccuracy?: boolean;
}): Promise<Location.LocationObject | null> => {
  const { timeout = 10000, highAccuracy = true } = options || {};
  
  try {
    // Check permission first
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      return null;
    }
    
    // Check if location services are enabled
    const servicesEnabled = await Location.hasServicesEnabledAsync();
    if (!servicesEnabled) {
      Alert.alert(
        "Location Services Disabled",
        "Please enable location services in your device settings to share your location during emergencies.",
        [{ text: "OK" }]
      );
      return null;
    }
    
    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Location timeout")), timeout);
    });
    
    // Get location with timeout
    const locationPromise = Location.getCurrentPositionAsync({
      accuracy: highAccuracy ? Location.Accuracy.Highest : Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    });
    
    const location = await Promise.race([locationPromise, timeoutPromise]);
    return location;
    
  } catch (error) {
    console.error("Error getting location:", error);
    
    // Try with lower accuracy as fallback
    if (highAccuracy) {
      return getCurrentLocation({ ...options, highAccuracy: false });
    }
    
    return null;
  }
};

/**
 * Check if app has location permission
 */
export const hasLocationPermission = async (): Promise<boolean> => {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
};

/**
 * Open device settings for manual permission management
 */
export const openPermissionSettings = () => {
  Alert.alert(
    "Manage Permissions",
    "You can manage app permissions in your device settings.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() }
    ]
  );
};

/**
 * Explain what permissions the app uses and why
 */
export const showPermissionExplanation = () => {
  Alert.alert(
    "App Permissions",
    "ReadyNow uses the following permissions:\n\n" +
    "📍 Location (Optional): Share your location during emergencies to help responders find you\n\n" +
    "🔐 Biometrics: Secure access to your emergency plan\n\n" +
    "📳 Vibration: Alert feedback\n\n" +
    "🌐 Internet: Send emergency alerts\n\n" +
    "All permissions are used only for emergency and safety features.",
    [{ text: "OK" }]
  );
};

/**
 * Permission status helper for UI
 */
export const getPermissionStatusText = (granted: boolean): string => {
  return granted ? "Enabled" : "Disabled";
};

/**
 * Check all app permissions status
 */
export const checkAllPermissions = async () => {
  const locationGranted = await hasLocationPermission();
  
  return {
    location: locationGranted,
    // Add other permissions as needed
  };
}; 