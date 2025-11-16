import { startChatListener, getChatStats } from "../twitch/chatTracker.js";
import Streamer from "../models/streamerModel.js";
import { clipQueue } from "../jobs/clipQueue.js";

// Track active listeners
const activeStreamers = new Map();

export async function startMonitoringStreamer(streamerLogin) {
  if (!streamerLogin) {
    return { message: "streamerLogin required" };
  }

  if (activeStreamers.has(streamerLogin)) {
    return { message: `Already monitoring ${streamerLogin}` };
  }

  console.log(`🎧 Starting chat monitoring for ${streamerLogin}`);

  // Start Twurple chat listener
  await startChatListener(streamerLogin);

  activeStreamers.set(streamerLogin, true);

  // Check spike every 15s
  setInterval(() => {
    const stats = getChatStats(streamerLogin);

    console.log(`📊 ${streamerLogin}: ${stats.count}/${stats.baseline}`);

    if (stats.count >= stats.baseline * 5) {
      console.log(`🔥 Spike detected for ${streamerLogin}`);

      clipQueue.add("autoClip", {
        streamerLogin,
        spikeComments: stats.count,
        baselineComments: stats.baseline,
        duration: 15
      });

      stats.count = 0; // reset
    }
  }, 15000);

  return { message: `Started monitoring ${streamerLogin}` };
}

export function stopMonitoringStreamer(streamerLogin) {
  activeStreamers.delete(streamerLogin);
  return { message: `Stopped monitoring ${streamerLogin}` };
}

export const getStreamers = async (req, res) => {
  try {
    const streamers = await Streamer.find({}).select("login -_id");
    const streamerLogins = streamers.map((s) => s.login);

    res.json(streamerLogins.length ? streamerLogins : ["tolzzyyy23"]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
