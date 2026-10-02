import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import {
  getCurrentUser,
  isAuthenticated,
  requestSmsCode,
  signOut as authSignOut,
  STORAGE_KEYS,
  UserInfo,
  verifyOtpCode,
} from "./auth-service";

// Context type
interface AuthContextType {
  user: UserInfo | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  login: (phoneNumber: string) => Promise<boolean>;
  verifyCode: (phoneNumber: string, code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  checkAuthStatus: () => Promise<boolean>;
  refreshAuthStatus: () => Promise<void>;
}

// Default context
const defaultAuthContext: AuthContextType = {
  user: null,
  isLoading: true,
  isLoggedIn: false,
  login: async () => false,
  verifyCode: async () => false,
  signOut: async () => {},
  checkAuthStatus: async () => false,
  refreshAuthStatus: async () => {},
};

// Create the context
const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    void checkAuthStatus();
  }, []);

  // Function to check auth status
  const checkAuthStatus = async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const authenticated = await isAuthenticated();
      setIsLoggedIn(authenticated);

      if (authenticated) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        return true;
      } else {
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      setIsLoggedIn(false);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Login function - requests SMS verification
  const login = async (phoneNumber: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      await requestSmsCode(phoneNumber);
      return true;
    } catch (error) {
      console.error("Error in login:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Verify code function - completes authentication
  const verifyCode = async (
    phoneNumber: string,
    code: string
  ): Promise<boolean> => {
    setIsLoading(true);
    try {
      const userInfo = await verifyOtpCode(phoneNumber, code);
      setUser(userInfo);
      setIsLoggedIn(true);

      // Check and set onboarding status for new users
      const onboardingStatus = await SecureStore.getItemAsync(
        STORAGE_KEYS.ONBOARDING_COMPLETED
      );

      if (onboardingStatus === null || onboardingStatus === undefined) {
        // If onboarding status doesn't exist, this is a new user
        await SecureStore.setItemAsync(
          STORAGE_KEYS.ONBOARDING_COMPLETED,
          "false"
        );
      }

      return true;
    } catch (error) {
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await authSignOut();
      setUser(null);
      setIsLoggedIn(false);
      router.replace("/");
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh auth status function - useful for manual SecureStore updates
  const refreshAuthStatus = async (): Promise<void> => {
    try {
      const authenticated = await isAuthenticated();
      setIsLoggedIn(authenticated);

      if (authenticated) {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error refreshing auth status:", error);
      setIsLoggedIn(false);
      setUser(null);
    }
  };

  // Create the context value
  const contextValue: AuthContextType = {
    user,
    isLoading,
    isLoggedIn,
    login,
    verifyCode,
    signOut,
    checkAuthStatus,
    refreshAuthStatus,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

// Hook to use the auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthProvider;
