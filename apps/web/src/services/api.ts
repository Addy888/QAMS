import axios from "axios";
import { useAuthStore } from "@/features/auth/store/authStore";

export const api = axios.create({
  baseURL: "http://localhost:8000",
});

/**
 * Attach the JWT access token from the auth store on every outgoing request.
 * Reading the store directly here avoids having to thread the token through
 * every call site.
 */
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});
