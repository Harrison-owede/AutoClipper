import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import fs from "fs";

let clients = {};  // chat clients per streamer
let stats = {};    // { streamer: { count, baseline, lastReset } }

// Ensure stats object exists for a streamer
function ensureStats(streamer) {
  if (!stats[streamer]) {
    stats[streamer] = {
      count: 0,
      baseline: 50,     // start neutral
      lastReset: Date.now()
    };
  }
  return stats[streamer];
}

// Get stats for a streamer
export const getChatStats = (streamerLogin) => {
  return ensureStats(streamerLogin);
};

// Start chat listener for a streamer
export const startChatListener = async (streamerLogin) => {
  if (!streamerLogin) return;

  // Prevent multiple connections
  if (clients[streamerLogin]) return;

  console.log(`🚀 Starting chat listener for ${streamerLogin}`);

  // Load tokens
  const tokenData = JSON.parse(fs.readFileSync("./tokens.json", "utf8"));
  const authProvider = new RefreshingAuthProvider(
    {
      clientId: process.env.TWITCH_CLIENT_ID,
      clientSecret: process.env.TWITCH_CLIENT_SECRET,
    },
    tokenData
  );

  // Create chat client with required intent
  const chat = new ChatClient({
    authProvider,
    channels: [streamerLogin],
    intents: ["chat"], // REQUIRED for Twurple v6+
  });

  await chat.connect();
  console.log(`📡 Connected to Twitch chat for ${streamerLogin}`);

  clients[streamerLogin] = chat;

  // Handle incoming messages
  chat.onMessage((channel, user, message) => {
    const s = ensureStats(streamerLogin);
    s.count++;
  });

  // Smoothly update baseline every 60 seconds
  setInterval(() => {
    const s = ensureStats(streamerLogin);
    s.baseline = Math.max(1, Math.floor(s.baseline * 0.8 + s.count * 0.2));
    s.count = 0;
  }, 60_000);
};
