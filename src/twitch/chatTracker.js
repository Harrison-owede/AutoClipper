import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import fs from "fs";

let clients = {};  // chat clients per streamer
let stats = {};    // { streamer: { count, baseline, lastReset } }

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

export const getChatStats = (streamerLogin) => {
  return ensureStats(streamerLogin);
};

export const startChatListener = async (streamerLogin) => {
  if (!streamerLogin) return;

  // if already listening, do nothing
  if (clients[streamerLogin]) return;

  console.log(`🚀 Starting chat listener for ${streamerLogin}`);

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  // Load your OAuth tokens
  const tokenData = JSON.parse(fs.readFileSync("./tokens.json", "utf8"));

  const authProvider = new RefreshingAuthProvider(
    { clientId, clientSecret },
    tokenData
  );

  const chat = new ChatClient({
    authProvider,
    channels: [streamerLogin],
  });

  // Connect
  await chat.connect();
  console.log(`📡 Connected to Twitch chat for ${streamerLogin}`);

  // Store connection
  clients[streamerLogin] = chat;

  // Handle messages
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
