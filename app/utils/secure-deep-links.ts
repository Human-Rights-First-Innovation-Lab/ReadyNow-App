import { Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { AUTH0_CONFIG } from "./auth-config";

/**
 * Domains allowed to deep link into the app.
 *
 * This is a trust boundary: a domain listed here can hand the app a URL that
 * it will act on. It used to hardcode the *development* Auth0 tenant, which
 * meant a production build either rejected its own legitimate auth callbacks
 * or accepted callbacks from the dev tenant - a tenant with weaker controls
 * and a wider set of people who can configure it.
 *
 * It now derives from EXPO_PUBLIC_AUTH0_DOMAIN via AUTH0_CONFIG, the same
 * value the app actually authenticates against, so the allowlist cannot drift
 * from the tenant in use. There is no custom domain; Auth0 is the only
 * verified deep link source.
 */
const VERIFIED_DOMAINS = [AUTH0_CONFIG.domain] as const;

/** Valid path prefixes, keyed by verified domain. */
const VALID_PATH_PREFIXES: Record<string, readonly string[]> = {
  [AUTH0_CONFIG.domain]: [
    "/android/com.innovationlab.alertbuttonexpo/callback",
  ],
};

export interface DeepLinkInfo {
  isValid: boolean;
  domain?: string;
  path?: string;
  fullUrl?: string;
  reason?: string;
}

/**
 * Validates if a deep link is from a verified source
 */
export const validateDeepLink = (url: string): DeepLinkInfo => {
  try {
    // Parse the URL
    const urlObj = new URL(url);
    
    // Only allow HTTPS schemes (no custom schemes)
    if (urlObj.protocol !== "https:") {
      return {
        isValid: false,
        reason: `Invalid protocol: ${urlObj.protocol}. Only HTTPS links are allowed.`
      };
    }
    
    // Check if domain is verified
    const domain = urlObj.hostname;
    if (!VERIFIED_DOMAINS.includes(domain)) {
      return {
        isValid: false,
        domain,
        reason: `Unverified domain: ${domain}. Only verified domains are allowed.`
      };
    }
    
    // Check if path prefix is valid for this domain
    const path = urlObj.pathname;
    const validPrefixes = VALID_PATH_PREFIXES[domain];
    
    const hasValidPrefix = validPrefixes?.some(prefix => path.startsWith(prefix));
    if (!hasValidPrefix) {
      return {
        isValid: false,
        domain,
        path,
        reason: `Invalid path: ${path}. Valid prefixes for ${domain}: ${validPrefixes?.join(", ")}`
      };
    }
    
    return {
      isValid: true,
      domain,
      path,
      fullUrl: url
    };
    
  } catch (error) {
    return {
      isValid: false,
      reason: `Invalid URL format: ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
};

/**
 * Safely handles a deep link with validation
 */
export const handleSecureDeepLink = (url: string, onValidLink?: (linkInfo: DeepLinkInfo) => void): boolean => {
  const validation = validateDeepLink(url);
  
  if (!validation.isValid) {
    console.warn("🚨 Security: Blocked unverified deep link", {
      url,
      reason: validation.reason
    });
    return false;
  }

  
  // Call the handler if provided
  if (onValidLink) {
    onValidLink(validation);
  }
  
  return true;
};

/**
 * Sets up secure deep link listening with validation
 */
export const setupSecureDeepLinkListener = (
  onValidLink?: (linkInfo: DeepLinkInfo) => void
) => {
  // Handle app launch from deep link
  Linking.getInitialURL().then((url) => {
    if (url) {
      handleSecureDeepLink(url, onValidLink);
    }
  });
  
  // Handle deep links while app is running
  const subscription = Linking.addEventListener("url", (event) => {
    handleSecureDeepLink(event.url, onValidLink);
  });
  
  return subscription;
};

/**
 * Opens an external URL safely in the browser
 */
export const openExternalLink = async (url: string): Promise<void> => {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch (error) {
    console.error("Error opening external link:", error);
  }
}; 

export default {
  validateDeepLink,
  handleSecureDeepLink,
  setupSecureDeepLinkListener,
  openExternalLink
};
