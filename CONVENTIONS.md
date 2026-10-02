# Code Conventions

This document outlines the established patterns, conventions, and architectural decisions in the ReadyNow codebase. Following these conventions ensures consistency, maintainability, and helps code assistants generate idiomatic changes that align with team expectations.

## Table of Contents

1. [Project Architecture](#project-architecture)
2. [File Organization & Naming](#file-organization--naming)
3. [TypeScript Conventions](#typescript-conventions)
4. [React Native Component Patterns](#react-native-component-patterns)
5. [Storage & Data Management](#storage--data-management)
6. [API Integration Patterns](#api-integration-patterns)
7. [Styling & UI Conventions](#styling--ui-conventions)
8. [Security Conventions](#security-conventions)
9. [Error Handling & Logging](#error-handling--logging)
10. [Translation & Internationalization](#translation--internationalization)
11. [Import & Export Patterns](#import--export-patterns)
12. [Documentation Standards](#documentation-standards)

## Project Architecture

### Tech Stack

- **Framework**: Expo (React Native)
- **Language**: TypeScript with strict mode enabled
- **Authentication**: Auth0 (passwordless SMS)
- **Storage**: expo-secure-store for sensitive data
- **API Integration**: REST APIs (NILRA API)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Internationalization**: Custom translation system
- **Security**: Biometric authentication, data encryption

### Directory Structure

```text
app/
├── components/            # Shared React Native components
│   ├── AlertButton.tsx    # Main alert button component
│   ├── Button.tsx         # Reusable button component
│   └── CustomModal.tsx    # Modal components
├── screens/               # Screen components
│   ├── emergency-plan/    # Emergency plan screens
│   ├── welcome/          # Welcome/onboarding screens
│   └── settings.tsx      # Settings screen
├── utils/                 # Utility functions
│   ├── auth-service.ts   # Authentication utilities
│   ├── storage-utils.ts  # SecureStore operations
│   ├── encryption-utils.ts # Data encryption
│   └── app-settings.tsx  # App configuration
├── services/             # External API services
│   └── nilra-api.ts      # NILRA API integration
├── translations/         # Internationalization
│   ├── index.ts         # Translation utilities
│   └── *.json           # Language files
├── context/             # React Context providers
│   └── ModalContext.tsx  # Modal state management
├── types/               # TypeScript type definitions
└── _layout.tsx          # Root layout component
```

## File Organization & Naming

### Naming Conventions

- **Files**: Use `camelCase` for TypeScript files, `PascalCase` for component files
- **Components**: Use `PascalCase` for component files and directory names
- **Hooks**: Prefix with `use` and use `camelCase` (e.g., `useAppSettings`, `usePageTranslation`)
- **Types**: Use `PascalCase` with descriptive names (e.g., `EmergencyPlanData`, `LegalSupportData`)
- **Constants**: Use `UPPER_SNAKE_CASE` for environment variables and true constants
- **Storage Keys**: Use `camelCase` for SecureStore keys (e.g., `emergency_plan_data`)

### Component Organization

```text
components/
├── ComponentName.tsx          # Main component
├── ComponentName.test.tsx     # Tests (if applicable)
└── _components/               # Sub-components (if needed)
```

### Feature-Based Organization

- Follow Expo Router conventions for file-based routing
- Group related functionality by domain (e.g., `emergency-plan/`, `welcome/`)
- Each feature directory contains screens, components, and feature-specific logic
- Shared components go in `app/components/`
- Utilities go in `app/utils/`

## TypeScript Conventions

- We never use the `any` type. Prefer `unknown` if a more accurate type is not possible
- Always use the more specific type available (union over generic string, etc.)
- Written code should be free of type errors
- Use strict mode enabled in tsconfig.json

### Type Definitions

```typescript
// Use interfaces for object shapes that might be extended
interface LegalSupportData {
  firstName: string;
  lastName: string;
  middleName?: string;
  aNumber?: string;
  countryOfBirth: string;
  hasImmigrationAttorney: string;
  immigrationAttorneyNotes?: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactEmail?: string;
  emergencyContactRelationship: string;
  canContactEmergencyContact: boolean;
  enableLocationSharing: boolean;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp: number;
  };
}

// Use type aliases for unions, computed types, or complex transformations
type EmergencyPlanData = Record<
  string,
  {
    messages: MessageData[];
    createdAt: string;
    updatedAt: string;
  }
>;

type ValidationResult = {
  isValid: boolean;
  message: string;
};

// Use standard schema naming with PascalCase
export interface NilraIntakeData {
  hasImmigrationAttorney: string;
  immigrationAttorneyNotes: string;
  alienNumber: string | null;
  lastName: string;
  middleName: string;
  firstName: string;
  birthCountry: string;
  canContact: boolean;
  contactPerson: {
    relationship: string;
    lastName: string;
    firstName: string;
    phone: string;
    email: string;
  };
  latitudeLocation: number | null;
  longitudeLocation: number | null;
  locationStreet: string;
  locationCity: string;
  locationState: string;
  locationZipCode: string;
}
```

### Generic Patterns

```typescript
// Use descriptive generic names
export const TimeRangeComponent = <TData extends object>(
  props: ComponentProps<TData>
) => {
  // Component implementation
};

// Use constraint patterns for type safety
type SecureStoreData = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

interface StorageManager<T extends SecureStoreData> {
  data: T;
  key: string;
}
```

### Utility Types

- Create composite types for complex data structures (`EmergencyPlanData`, `LegalSupportData`)
- Use `type` imports to avoid runtime imports: `import type { LegalSupportData } from "../components/LegalSupportForm"`
- Define API response types explicitly (`NilraApiResponse`)

## React Native Component Patterns

### Component Structure

```typescript
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

interface AlertButtonProps {
  onPress: () => void;
  size?: number;
  disabled?: boolean;
  isDemoMode?: boolean;
}

const AlertButton: React.FC<AlertButtonProps> = ({
  onPress,
  size = 200,
  disabled = false,
  isDemoMode = false,
}) => {
  const router = useRouter();
  const [pressing, setPressing] = useState(false);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Animation for the press progress
  useEffect(() => {
    if (pressing) {
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();
    } else {
      animatedValue.setValue(0);
    }
  }, [pressing, animatedValue]);

  // Clean up timers when component unmounts
  useEffect(() => {
    return () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
      }
    };
  }, []);

  return (
    <View className="items-center justify-center px-5 shadow-md shadow-gray-400">
      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          elevation: disabled ? 0 : 8,
          shadowColor: "#000",
          shadowOffset: { width: 1, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          overflow: "hidden",
        }}
      >
        <TouchableOpacity
          className={`items-center justify-center overflow-hidden ${
            isDemoMode ? "bg-[#34C759]" : "bg-[#e56049]"
          }`}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text className="p-2.5 text-center text-2xl font-bold text-white">
            Send Alert
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default AlertButton;
```

### Props Patterns

```typescript
// Define props interface separately for reusability
interface ButtonProps {
  text: string;
  onPress: () => void;
  style?: object;
  disabled?: boolean;
  className?: string;
}

// Use destructuring with defaults in component signature
export const Button = ({
  text,
  onPress,
  style,
  disabled = false,
  className,
}: ButtonProps) => {
  // Component logic
};
```

### Hooks Patterns

```typescript
/**
 * Hook to manage app settings and configuration
 * @returns Object containing settings and update functions
 */
export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>({
    language: "en",
    theme: "light",
  });

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  return { settings, updateSettings };
}

/**
 * Hook for page translations
 * @param page - The page key for translations
 * @param language - The current language
 * @returns Translation function
 */
export function usePageTranslation(page: string, language: string) {
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTranslations(page, language).then(setTranslations);
  }, [page, language]);

  const t = useCallback(
    (key: string) => {
      return translations[key] || key;
    },
    [translations]
  );

  return { t };
}
```

### Component Composition

- Prefer composition over inheritance
- Use render props or children functions for flexible components
- Create wrapper components for common patterns (e.g., `CustomModal`, `Button`)
- Use React Context for global state management

## Storage & Data Management

### SecureStore Patterns

```typescript
import * as SecureStore from "expo-secure-store";

// Always use SecureStore for sensitive data
export const saveEmergencyPlanData = async (
  data: { messages: MessageData[] } | MessageData[],
  userPhoneNumber?: string
): Promise<void> => {
  try {
    // Get user's phone number
    let phoneNumber = userPhoneNumber;
    if (!phoneNumber) {
      const storedPhoneNumber = await SecureStore.getItemAsync(USER_PHONE_KEY);
      phoneNumber = storedPhoneNumber ?? undefined;
    }

    // Transform to new format
    const oldFormatData = { messages };
    const newFormatData = transformToNewFormat(oldFormatData, phoneNumber);

    // Encrypt data before storing
    const jsonData = JSON.stringify(newFormatData);
    const encryptedData = await encryptData(jsonData);

    // Handle chunking for large data
    if (jsonData.length > MAX_CHUNK_SIZE) {
      const chunks = chunkString(encryptedData, MAX_CHUNK_SIZE);
      await SecureStore.setItemAsync(
        EMERGENCY_DATA_CHUNK_COUNT,
        chunks.length.toString()
      );

      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(
          `${EMERGENCY_DATA_CHUNK_PREFIX}${i}`,
          chunks[i]
        );
      }
    } else {
      await SecureStore.setItemAsync(EMERGENCY_DATA_KEY, encryptedData);
    }
  } catch (error) {
    console.error("Error saving emergency plan data:", error);
    throw error;
  }
};
```

### Data Migration Patterns

```typescript
// Use versioning for data format migrations
const DATA_FORMAT_VERSION_KEY = "emergency_data_format_version";

export const migrateToNewFormat = async (): Promise<void> => {
  try {
    const formatVersion = await SecureStore.getItemAsync(
      DATA_FORMAT_VERSION_KEY
    );

    // If already using new format, no migration needed
    if (formatVersion === "4") {
      return;
    }

    // Load old format data
    const storedData = await SecureStore.getItemAsync(EMERGENCY_DATA_KEY);
    if (!storedData) {
      await SecureStore.setItemAsync(DATA_FORMAT_VERSION_KEY, "4");
      return;
    }

    // Transform and save in new format
    const oldData = JSON.parse(storedData) as { messages: MessageData[] };
    const newFormatData = transformToNewFormat(oldData, phoneNumber);

    // Save with new version
    await saveEmergencyPlanData(newFormatData);
    await SecureStore.setItemAsync(DATA_FORMAT_VERSION_KEY, "4");
  } catch (error) {
    console.error("Error migrating data:", error);
  }
};
```

### Chunking Patterns

```typescript
// Maximum size per chunk (1800 bytes is safe, leaving room for overhead)
const MAX_CHUNK_SIZE = 1800;

// Helper function to split a string into chunks
const chunkString = (str: string, size: number): string[] => {
  const chunks = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.substring(i, i + size));
  }
  return chunks;
};

// Load chunked data
export const loadChunkedData = async (): Promise<string> => {
  const chunkCountStr = await SecureStore.getItemAsync(
    EMERGENCY_DATA_CHUNK_COUNT
  );

  if (!chunkCountStr) {
    return (await SecureStore.getItemAsync(EMERGENCY_DATA_KEY)) || "";
  }

  const chunkCount = parseInt(chunkCountStr, 10);
  const chunks: string[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const chunk = await SecureStore.getItemAsync(
      `${EMERGENCY_DATA_CHUNK_PREFIX}${i}`
    );
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks.join("");
};
```

## API Integration Patterns

### REST API Patterns

```typescript
/**
 * Send intake data to NILRA API
 */
export const sendIntakeToNilra = async (
  legalSupportData: LegalSupportData,
  userId?: string,
  phoneNumber?: string,
  appLanguage?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get API credentials from environment
    const API_URL = process.env.EXPO_PUBLIC_NILRA_API_URL;
    const API_KEY = process.env.EXPO_PUBLIC_NILRA_API_KEY;

    if (!API_URL || !API_KEY) {
      throw new Error("NILRA API credentials not configured");
    }

    // Transform data to API format
    const intakeData = transformToNilraFormat(legalSupportData);

    // Construct full URL
    const fullUrl = API_URL.endsWith("/")
      ? `${API_URL}Intake`
      : `${API_URL}/Intake`;

    // Make API request
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY,
      },
      body: JSON.stringify(intakeData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `NILRA API returned status ${response.status}: ${errorText}`,
      };
    }

    const result = (await response.json()) as NilraApiResponse;
    return {
      success: result.status === 200,
      error: result.status !== 200 ? result.title : undefined,
    };
  } catch (error) {
    console.error("NILRA API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
```

### Error Handling in API Calls

```typescript
// Always handle errors gracefully in API calls
try {
  const result = await sendIntakeToNilra(data);
  if (!result.success) {
    console.error("API call failed:", result.error);
    // Handle error appropriately - don't block user flow
  }
} catch (error) {
  console.error("Unexpected error:", error);
  // Log error but continue with user flow
}
```

### Request/Response Transformation

```typescript
/**
 * Transform LegalSupportData to NILRA API format
 */
export const transformToNilraFormat = (
  legalSupportData: LegalSupportData
): NilraIntakeData => {
  // Parse emergency contact name
  const contactNameParts = legalSupportData.emergencyContactName
    .trim()
    .split(/\s+/);
  const contactFirstName = contactNameParts[0] || "";
  const contactLastName = contactNameParts.slice(1).join(" ") || "";

  return {
    hasImmigrationAttorney:
      legalSupportData.hasImmigrationAttorney || "Unknown",
    immigrationAttorneyNotes: legalSupportData.immigrationAttorneyNotes || "",
    alienNumber: legalSupportData.aNumber?.trim() || null,
    lastName: legalSupportData.lastName || "",
    middleName: legalSupportData.middleName || "",
    firstName: legalSupportData.firstName || "",
    birthCountry: legalSupportData.countryOfBirth || "",
    canContact: legalSupportData.canContactEmergencyContact || false,
    contactPerson: {
      relationship: legalSupportData.emergencyContactRelationship || "",
      lastName: contactLastName,
      firstName: contactFirstName,
      phone: legalSupportData.emergencyContactPhone || "",
      email: legalSupportData.emergencyContactEmail || "",
    },
    latitudeLocation: legalSupportData.location?.latitude || null,
    longitudeLocation: legalSupportData.location?.longitude || null,
    locationStreet: "",
    locationCity: "",
    locationState: "",
    locationZipCode: "",
  };
};
```

## Styling & UI Conventions

### NativeWind Usage

```typescript
// Use NativeWind classes for styling
<View className="flex-1 items-center justify-center px-5 shadow-md shadow-gray-400">
  <TouchableOpacity
    className={`items-center justify-center overflow-hidden ${
      isDemoMode ? "bg-[#34C759]" : "bg-[#e56049]"
    }`}
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
    }}
  >
    <Text className="p-2.5 text-center text-2xl font-bold text-white">
      Send Alert
    </Text>
  </TouchableOpacity>
</View>

// Use conditional classes with template literals
<View className={`flex flex-col justify-between rounded-[24px] bg-primary-5 p-[20px] ${
  isActive ? 'border-2 border-blue-500' : 'border border-gray-300'
}`}>
  <Text className="label-medium leading-none text-primary-1">{title}</Text>
  <Text className="label-xsmall leading-none text-secondary">{subtitle}</Text>
</View>
```

### Platform-Specific Styling

```typescript
import { Platform } from "react-native";

// Use Platform.select for platform-specific values
const styles = {
  container: {
    paddingTop: Platform.select({
      ios: 20,
      android: 25,
      default: 0,
    }),
    shadowColor: Platform.select({
      ios: "#000",
      android: "#000",
      default: "transparent",
    }),
  },
};

// Use Platform.OS for conditional logic
if (Platform.OS === "ios") {
  // iOS-specific code
} else if (Platform.OS === "android") {
  // Android-specific code
}
```

### Component Styling

- Avoid inline styles and custom CSS classes
- Use NativeWind utility classes exclusively
- Use template literals for conditional classes
- Allow `className` prop override for flexibility
- Use custom color palette and design system
- Use custom typography classes (label-medium, body-components, etc.)

### Animation Patterns

```typescript
import { Animated, Easing } from "react-native";

// Use Animated API for smooth animations
const animatedValue = useRef(new Animated.Value(0)).current;

useEffect(() => {
  if (pressing) {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: false, // Use false for layout properties
    }).start();
  } else {
    animatedValue.setValue(0);
  }
}, [pressing, animatedValue]);

// Use interpolate for complex animations
<Animated.View
  style={{
    height: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0%", "100%"],
    }),
  }}
/>;
```

## Security Conventions

### Biometric Authentication

```typescript
import * as LocalAuthentication from "expo-local-authentication";

// Always use biometric authentication for sensitive operations
export const authenticateWithBiometrics = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      return false;
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      return false;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to access sensitive data",
      fallbackLabel: "Use passcode",
    });

    return result.success;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    return false;
  }
};
```

### Data Encryption

```typescript
import * as Crypto from "expo-crypto";

// Always encrypt sensitive data before storing
export const encryptData = async (data: string): Promise<string> => {
  try {
    // Generate a random key
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      "your-secret-key",
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    // Encrypt the data (simplified example)
    const encrypted = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data + key,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );

    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw error;
  }
};

export const decryptData = async (encryptedData: string): Promise<string> => {
  // Placeholder implementation: decryption not supported.
  // In production, use proper encryption libraries.
  throw new Error("decryptData is a placeholder and does not perform decryption. Implement this function with a proper decryption algorithm before use.");
};
```

### Secure Data Wiping

```typescript
// Always wipe sensitive data after use
export const wipeSensitiveData = async (): Promise<void> => {
  try {
    const keysToWipe = [
      "emergency_plan_data",
      "additionalLegalHelp",
      "user_phone_number",
      "emergency_data_format_version",
      "emergency_data_chunk_count",
    ];

    // Wipe individual data
    for (const key of keysToWipe) {
      await SecureStore.deleteItemAsync(key);
    }

    // Wipe chunked data
    const chunkCountStr = await SecureStore.getItemAsync(
      "emergency_data_chunk_count"
    );
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`emergency_data_chunk_${i}`);
      }
    }
  } catch (error) {
    console.error("Error wiping sensitive data:", error);
  }
};
```

### iOS Backup Exclusion

```typescript
// Exclude sensitive data from iOS backups
import { Platform } from "react-native";

if (Platform.OS === "ios") {
  // Use iOS-specific backup exclusion
  await SecureStore.setItemAsync(key, value, {
    requireAuthentication: true,
    authenticationPrompt: "Access sensitive data",
  });
}
```

## Error Handling & Logging

### Error Handling Patterns

```typescript
// Always handle errors gracefully
try {
  const result = await someAsyncOperation();
  return result;
} catch (error) {
  console.error("Operation failed:", error);

  // Don't expose sensitive information in error messages
  const safeError = error instanceof Error ? error.message : "Unknown error";

  // Return safe error or default value
  return { success: false, error: safeError };
}

// Use error boundaries for React Native
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <Text>Something went wrong.</Text>;
    }

    return this.props.children;
  }
}
```

### Logging Levels

- `console.error()` for errors that need attention
- `console.warn()` for concerning but non-critical issues
- `console.info()` for important operational information
- `console.debug()` for detailed debugging information
- Never log sensitive data in production

### Platform-Specific Error Handling

```typescript
import { Platform, Alert } from "react-native";

// Handle platform-specific errors
const handleLocationError = (error: Error) => {
  if (Platform.OS === "ios") {
    // iOS-specific error handling
    if (error.message.includes("denied")) {
      Alert.alert(
        "Location Permission",
        "Please enable location services in Settings"
      );
    }
  } else if (Platform.OS === "android") {
    // Android-specific error handling
    if (error.message.includes("permission")) {
      Alert.alert("Location Permission", "Please grant location permission");
    }
  }
};
```

## Translation & Internationalization

### Translation Hook Usage

```typescript
import { usePageTranslation } from "../translations";

// Use translation hook in components
const MyComponent = () => {
  const { settings } = useAppSettings();
  const { t } = usePageTranslation("alert-button", settings.language);

  return (
    <Text className="text-center text-2xl font-bold text-white">
      {t("sendAlert")}
    </Text>
  );
};
```

### Translation File Structure

```typescript
// app/translations/index.ts
export const usePageTranslation = (page: string, language: string) => {
  const [translations, setTranslations] = useState<Record<string, string>>({});

  useEffect(() => {
    loadTranslations(page, language).then(setTranslations);
  }, [page, language]);

  const t = useCallback((key: string) => {
    return translations[key] || key;
  }, [translations]);

  return { t };
};

// app/translations/alert-button.json
{
  "sendAlert": "Send Alert",
  "sendingAlert": "Sending Alert",
  "alertCancelled": "Alert Cancelled",
  "emergencyMessagesSent": "Emergency messages will be sent in {seconds} seconds"
}
```

### Multi-Language Support Patterns

```typescript
// Support multiple languages
const SUPPORTED_LANGUAGES = ["en", "es", "ko"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Language-specific formatting
const formatPhoneNumber = (phone: string, language: string): string => {
  switch (language) {
    case "en":
      return phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    case "es":
      return phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    default:
      return phone;
  }
};
```

## Import & Export Patterns

### Import Organization

```typescript
// 1. React and React Native imports
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";

// 2. Expo imports
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

// 3. Internal utilities and types
import type { EmergencyPlanData } from "../utils/emergency-plan-utils";
import { decryptData } from "../utils/encryption-utils";
import { transformToOldFormat } from "../utils/emergency-plan-utils";

// 4. Components and hooks
import Button from "./Button";
import { useAppSettings } from "../utils/app-settings";
import { usePageTranslation } from "../translations";
```

### Path Aliases

- Use relative imports for files in the same directory or nearby
- Use absolute imports from `app/` root for deeply nested files
- Prefer relative imports for better maintainability

### Export Patterns

```typescript
// Named exports for utilities and components
export const utilityFunction = () => {};
export const Component = () => {};

// Default exports for main module exports
export default Component;

// Re-exports for barrel files
export { Component } from "./Component";
export type { ComponentProps } from "./Component";

// Export types separately
export type { LegalSupportData, NilraIntakeData } from "./types";
```

## Documentation Standards

### JSDoc Comments

````typescript
/**
 * Save emergency plan data with encryption and chunking support
 * @description Handles large data by splitting into chunks and encrypts sensitive information
 * @param data - The emergency plan data to save
 * @param userPhoneNumber - Optional phone number for data association
 * @throws {Error} When encryption or storage fails
 * @example
 * ```typescript
 * await saveEmergencyPlanData({ messages: [...] }, "+1234567890");
 * ```
 */
export const saveEmergencyPlanData = async (
  data: { messages: MessageData[] } | MessageData[],
  userPhoneNumber?: string
): Promise<void> => {
  // Implementation
};
````

### Code Comments

```typescript
// TODO: Implement proper encryption algorithm
// FIXME: Handle edge case where phone number is null
// NOTE: This function handles both old and new data formats

// Explain complex business logic
// This handles the special case where users have multiple contact methods
// and we need to prioritize the primary phone number
const getPrimaryContact = (contacts: Contact[]): Contact | null => {
  return contacts.find((contact) => contact.isPrimary) || contacts[0] || null;
};
```

### README and Documentation

- Keep documentation up-to-date with code changes
- Include examples for complex APIs or components
- Document architectural decisions and their rationale
- Provide setup instructions and common troubleshooting steps
- Reference CONVENTIONS.md in development workflow

---

## Quick Reference Checklist

When creating or modifying code, ensure:

- [ ] File and component names follow naming conventions
- [ ] TypeScript types are properly defined and constrained
- [ ] Components use proper prop destructuring and defaults
- [ ] SecureStore operations include encryption for sensitive data
- [ ] Data chunking is implemented for large payloads
- [ ] Platform-specific code handles iOS and Android differences
- [ ] Styling uses NativeWind classes with conditional logic
- [ ] Errors are logged appropriately without exposing sensitive data
- [ ] Imports are organized and use proper path structure
- [ ] Documentation includes JSDoc comments for public APIs
- [ ] Translation keys are used for all user-facing text
- [ ] Biometric authentication is used for sensitive operations
- [ ] Data is properly wiped after use
- [ ] Timers and subscriptions are cleaned up in useEffect

This document serves as a living guide that should be updated as conventions evolve. When in doubt, look at existing similar implementations in the codebase for patterns to follow.
