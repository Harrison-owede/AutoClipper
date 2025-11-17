// chatTracker.js
import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import fs from "fs";

const statsMap = new Map();

export const startChatListener = async (streamerLogin) => {
  if (!streamerLogin) return;

  const tokenData = JSON.parse(fs.readFileSync("./tokens.json", "utf8"));
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  const authProvider = new RefreshingAuthProvider(
    { clientId, clientSecret },
    tokenData,
    {
      onRefresh: async (newTokenData) => {
        fs.writeFileSync("./tokens.json", JSON.stringify(newTokenData, null, 2));
        console.log("🔄 Tokens refreshed!");
      },
    }
  );

  await authProvider.addUserForToken(tokenData, ["chat"]);

  const chat = new ChatClient({
    authProvider,
    channels: [streamerLogin],
    requestMembershipEvents: true
  });

  chat.onMessage((channel, user, message) => {
    const cleanName = channel.replace("#", "");   // NORMALIZE NAME

    const stats = statsMap.get(cleanName) || {
      count: 0,
      baseline: 10,
    };

    stats.count++; // count messages ONLY
    statsMap.set(cleanName, stats);
  });

  await chat.connect();
  console.log(`📡 Connected to Twitch chat for ${streamerLogin}`);
};

export const getChatStats = (streamerLogin) => {
  return statsMap.get(streamerLogin) || { count: 0, baseline: 10 };
};

// 100% SAFE RESET FUNCTION
export const resetChatStats = (streamerLogin) => {
  const stats = statsMap.get(streamerLogin);
  if (stats) stats.count = 0;
};

export function stopChatListener(streamerLogin) {
  // close TMI client or event listener
}
