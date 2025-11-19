// src/utils/twitchTokenManager.js
import axios from "axios";

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let accessToken = null;
let expiry = 0;

// Return current token
export const getTwitchToken = () => accessToken;

// Fetch ONLY client_credentials token
export const initTwitchTokens = async () => {
  try {
    const res = await axios.post("https://id.twitch.tv/oauth2/token", null, {
      params: {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "client_credentials",
      },
    });

    accessToken = res.data.access_token;
    expiry = Date.now() + (res.data.expires_in * 1000);

    console.log("✅ New Twitch app token fetched");
    return accessToken;
  } catch (err) {
    console.error("❌ Failed to init Twitch token:", err.response?.data || err.message);
    throw err;
  }
};

// Auto-refresh every 50 min
export const refreshTwitchToken = async () => {
  console.log("🔄 Refreshing Twitch token (client_credentials)...");
  return await initTwitchTokens();
};

export const startAutoRefresh = () => {
  initTwitchTokens();
  setInterval(refreshTwitchToken, 50 * 60 * 1000);
};
