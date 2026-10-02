import "react-native-get-random-values";

/**
 * Secure Random Initialization and Validation
 * Call this early in your app lifecycle to ensure crypto.getRandomValues is available
 */

let isInitialized = false;
let initializationError: Error | null = null;

/**
 * Initialize and validate secure random functionality
 * This should be called at app startup before any cryptographic operations
 */
export const initializeSecureRandom = (): void => {
  try {
    // Check if crypto.getRandomValues is available
    if (typeof crypto === "undefined" || typeof crypto.getRandomValues !== "function") {
      throw new Error("crypto.getRandomValues is not available. react-native-get-random-values may not be properly installed.");
    }

    // Test crypto.getRandomValues with a small array
    const testArray = new Uint8Array(4);
    crypto.getRandomValues(testArray);

    // Verify that values were actually filled (not all zeros)
    const hasNonZeroValue = Array.from(testArray).some(value => value !== 0);
    if (!hasNonZeroValue) {
      console.warn("⚠️ crypto.getRandomValues may not be working correctly - all values are zero");
    }

    isInitialized = true;
  } catch (error) {
    initializationError = error instanceof Error ? error : new Error(String(error));
    console.error("❌ Failed to initialize secure random:", initializationError.message);
    throw initializationError;
  }
};

/**
 * Check if secure random has been properly initialized
 */
export const isSecureRandomInitialized = (): boolean => {
  return isInitialized && initializationError === null;
};

/**
 * Get initialization error if any
 */
export const getInitializationError = (): Error | null => {
  return initializationError;
};

/**
 * Validate that secure random is working correctly
 * This can be called periodically or before critical operations
 */
export const validateSecureRandom = (): void => {
  if (!isSecureRandomInitialized()) {
    throw new Error("Secure random is not initialized. Call initializeSecureRandom() first.");
  }

  try {
    // Generate multiple small arrays and ensure they're different
    const array1 = new Uint8Array(8);
    const array2 = new Uint8Array(8);
    
    crypto.getRandomValues(array1);
    crypto.getRandomValues(array2);

    // Arrays should be different (extremely unlikely to be identical)
    const arraysIdentical = array1.every((value, index) => value === array2[index]);
    if (arraysIdentical) {
      throw new Error("crypto.getRandomValues is not generating random data - consecutive calls returned identical results");
    }
  } catch (error) {
    const validationError = error instanceof Error ? error : new Error(String(error));
    console.error("❌ Secure random validation failed:", validationError.message);
    throw validationError;
  }
};

/**
 * SECURITY WARNING: Detect if Math.random is being used
 * This is a development-time check to catch accidental insecure random usage
 * Only warns for usage in your app code, not third-party libraries
 */
export const detectInsecureRandomUsage = (): void => {
  if (__DEV__) {
    const originalMathRandom = Math.random;
    const warnings = new Set<string>();

    // Override Math.random to warn about usage
    Math.random = () => {
      // Get stack trace to determine if call is from our app code
      const stack = new Error().stack || "";
      const stackLines = stack.split("\n");
      
      // Check if the call is from our app code (not node_modules or system)
      const isFromAppCode = stackLines.some(line => 
        line.includes("/app/") && 
        !line.includes("node_modules") &&
        !line.includes("expo-") &&
        !line.includes("react-native") &&
        !line.includes("metro") &&
        !line.includes("@react-") &&
        !line.includes("secureRandomInit.ts") // Ignore our own detection code
      );

      if (isFromAppCode) {
        // Extract the relevant stack line for the warning
        const appCodeLine = stackLines.find(line => 
          line.includes("/app/") && 
          !line.includes("secureRandomInit.ts")
        );
        
        const warningKey = appCodeLine || "unknown";
        
        if (!warnings.has(warningKey)) {
          warnings.add(warningKey);
          console.error("🚨 SECURITY WARNING: Math.random() is being used in your app code! This is insecure for cryptographic operations.");
          console.error("📍 Called from:", appCodeLine || "unknown location");
          console.error("💡 Use generateSecureToken() or crypto.getRandomValues() instead.");
          console.error("📖 See: app/utils/secureRandom.ts for secure alternatives");
        }
      }
      
      return originalMathRandom();
    };
  }
};

/**
 * Initialize everything needed for secure random operations
 * Call this once at app startup
 */
export const setupSecureRandom = (): void => {
  initializeSecureRandom();
  validateSecureRandom();
  detectInsecureRandomUsage();
  
}; 