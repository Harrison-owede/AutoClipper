import { 
  startChatListener, 
  stopChatListener,
  getChatStats, 
  resetChatStats 
} from "../twitch/chatTracker.js";

import { clipQueue } from "../jobs/clipQueue.js";

const activeStreamers = new Map();  
// Map<streamerLogin, { intervalId }>

export async function startMonitoringStreamer(streamerLogin) {
  if (!streamerLogin) return { message: "streamerLogin required" };

  if (activeStreamers.has(streamerLogin)) {
    return { message: `Already monitoring ${streamerLogin}` };
  }

  console.log(`🎧 Starting monitoring for ${streamerLogin}`);

  // Start chat listener
  await startChatListener(streamerLogin);

  // Create interval
  const intervalId = setInterval(() => {
    const stats = getChatStats(streamerLogin);

    if (!stats) return; // <-- 🚨 prevents crash

    console.log(`📊 ${streamerLogin}: ${stats.count}/${stats.baseline}`);

    if (stats.count >= stats.baseline * 5) {
      console.log(`🔥 Spike detected for ${streamerLogin}`);

      clipQueue.add("autoClip", {
        streamerLogin,
        spikeComments: stats.count,
        baselineComments: stats.baseline,
        duration: 15,
      });

      resetChatStats(streamerLogin); 
    }
  }, 15000);

  // Store interval ID
  activeStreamers.set(streamerLogin, { intervalId });

  return { message: `Started monitoring ${streamerLogin}` };
}

export function stopMonitoringStreamer(streamerLogin) {
  const streamer = activeStreamers.get(streamerLogin);

  if (!streamer) {
    return { message: `${streamerLogin} is not being monitored` };
  }

  // Stop the interval
  clearInterval(streamer.intervalId);

  // Stop chat listener
  stopChatListener(streamerLogin);

  // Remove from map
  activeStreamers.delete(streamerLogin);

  console.log(`🛑 Stopped monitoring ${streamerLogin}`);

  return { message: `Stopped monitoring ${streamerLogin}` };
}

export function getStreamers(req, res) {
  const streamers = Array.from(activeStreamers.keys());
  res.json({ streamers });
}
