import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import fs from "fs";

const statsMap = new Map(); // store chat stats per streamer

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

  const chat = new ChatClient({ authProvider, channels: [streamerLogin] });

  chat.onMessage((channel, user, message) => {
    // simple chat stats
    const stats = statsMap.get(channel) || { count: 0, baseline: 10 };
    stats.count++;
    statsMap.set(channel, stats);
  });

  await chat.connect();
  console.log(`📡 Connected to Twitch chat for ${streamerLogin}`);
};

// ✅ Export a function to get stats
export const getChatStats = (streamerLogin) => {
  return statsMap.get(streamerLogin) || { count: 0, baseline: 10 };
};
