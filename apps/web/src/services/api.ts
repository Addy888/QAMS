import axios from "axios";
import { useAuthStore } from "@/features/auth/store/authStore";

let activeBaseUrl = import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || "http://localhost:3000";
let isDiscovered = false;

export const getApiBaseUrl = () => activeBaseUrl;

export async function discoverActivePort() {
  if (isDiscovered || import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL) {
    return activeBaseUrl;
  }
  const ports = [3000, 3001, 3002];
  for (const port of ports) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 100);
      const url = `http://localhost:${port}`;
      await fetch(url, { method: "GET", signal: controller.signal });
      clearTimeout(id);
      activeBaseUrl = url;
      isDiscovered = true;
      console.log("Successfully discovered active API backend on:", activeBaseUrl);
      break;
    } catch (e) {
      // Ignore connection error
    }
  }
  return activeBaseUrl;
}

// Start discovery immediately in the background
discoverActivePort();

export const api = axios.create({
  baseURL: activeBaseUrl,
  timeout: 30000,
});

/**
 * Attach the JWT access token from the auth store on every outgoing request.
 * Reading the store directly here avoids having to thread the token through
 * every call site.
 */
api.interceptors.request.use(async (config) => {
  if (!isDiscovered && !import.meta.env.NEXT_PUBLIC_API_URL && !import.meta.env.VITE_API_URL) {
    await discoverActivePort();
  }
  config.baseURL = activeBaseUrl;
  
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});
