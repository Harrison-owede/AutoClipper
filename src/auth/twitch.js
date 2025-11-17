// src/auth/twitch.js
import { ApiClient } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";
import dotenv from "dotenv";

// Load env as early as possible
dotenv.config();

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  throw new Error("❌ Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in .env");
}

// Twurple v7 — App Token Auth
const authProvider = new AppTokenAuthProvider(clientId, clientSecret);

// Export API client for use everywhere
export const apiClient = new ApiClient({
  authProvider,
});
