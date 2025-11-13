// src/twitch/chatTracker.js
import tmi from "tmi.js";

const trackers = {}; // { streamer: { client, count, baseline, lastResetTimer } }

function ensureTracker(streamer) {
  if (trackers[streamer]) return trackers[streamer];
  trackers[streamer] = { client: null, count: 0, baseline: 50, lastResetTimer: null };
  return trackers[streamer];
}

export function getChatStats(streamer) {
  const t = ensureTracker(streamer);
  return { count: t.count, baseline: t.baseline };
}

// start a chat listener for a streamer (no-op if already started)
export function startChatListener(streamer) {
  if (!streamer) return;

  const t = ensureTracker(streamer);
  if (t.client) {
    // already listening; ensure the reset timer exists
    if (!t.lastResetTimer) startResetTimer(streamer);
    return;
  }

  const client = new tmi.Client({
    options: { debug: false },
    connection: { secure: true, reconnect: true },
    identity: {
      username: process.env.TWITCH_BOT_USERNAME,
      password: process.env.TWITCH_BOT_OAUTH,
    },
    channels: [streamer],
  });

  client.connect().catch((err) => {
    console.warn(`⚠️ chatTracker: failed to connect to channel ${streamer}:`, err.message || err);
  });

  client.on("message", () => {
    const s = ensureTracker(streamer);
    s.count = (s.count || 0) + 1;
  });

  client.on("connected", () => {
    console.log(`📡 Chat listener connected for ${streamer}`);
  });

  client.on("disconnected", (reason) => {
    console.log(`📴 Chat listener disconnected for ${streamer}:`, reason);
  });

  t.client = client;
  startResetTimer(streamer);
}

function startResetTimer(streamer) {
  const t = ensureTracker(streamer);
  if (t.lastResetTimer) return;
  // every 60s: blend baseline and reset count
  t.lastResetTimer = setInterval(() => {
    // adjust baseline smoothly: 80% old baseline + 20% current count
    t.baseline = Math.max(1, Math.floor(t.baseline * 0.8 + (t.count || 0) * 0.2));
    t.count = 0;
  }, 60_000);
}
