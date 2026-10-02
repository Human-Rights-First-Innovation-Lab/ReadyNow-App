import * as SecureStore from "expo-secure-store";
import { QueryClient } from "@tanstack/react-query";

// Createrent
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 1000,
    },
  },
});

export const getAuthToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync("auth_token");
};

export const getUserInfo = async (): Promise<Record<
  string,
  unknown
> | null> => {
  const userInfoStr = await SecureStore.getItemAsync("user_info");
  if (!userInfoStr) return null;

  try {
    return JSON.parse(userInfoStr) as Record<string, unknown>;
  } catch (e) {
    console.error("Error parsing user info:", e);
    return null;
  }
};

// Mock API functions for now
// Replace with actual API implementations when backend is ready
export const api = {
  // Example of a mock API call
  getUser: async (id: string) => {
    return { id, name: "Mock User" };
  },
  // Add more API functions as needed
};

// Type definitions for API inputs and outputs
export type RouterInputs = {
  user: {
    getUser: { id: string };
  };
};

export type RouterOutputs = {
  user: {
    getUser: { id: string; name: string };
  };
};

export default api;
