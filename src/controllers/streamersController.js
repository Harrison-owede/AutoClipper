// src/controllers/streamersController.js
import { ChatClient } from "twitch-chat-client";
import { StaticAuthProvider } from "twitch-auth";
import { clipQueue } from "../jobs/clipQueue.js";
import { getTwitchToken } from "../utils/twitchTokenManager.js";
import { getM3u8Url } from "../utils/m3u8.js";
import Streamer from "../models/streamerModel.js"; // <-- here


// Track active streamers to prevent duplicate monitoring
const activeStreamers = new Map();

export async function startMonitoringStreamer(streamerLogin) {
  if (activeStreamers.has(streamerLogin)) {
    return { message: `Already monitoring ${streamerLogin}` };
  }

  const { accessToken, clientId } = await getTwitchToken();
  const authProvider = new StaticAuthProvider(clientId, accessToken);
  const chatClient = new ChatClient(authProvider, { channels: [streamerLogin] });

  let commentCount = 0;
  let baseline = 5; // baseline can be dynamic later

  chatClient.onMessage((channel, user, message) => {
    commentCount++;
    if (commentCount >= baseline * 5) {
      console.log(`🔥 Spike detected for ${streamerLogin}`);
      const title = `SpikeClip-${Date.now()}`;

      getM3u8Url(streamerLogin, clientId, accessToken)
        .then(m3u8 => {
          if (!m3u8 || m3u8 === "offline") return;
          clipQueue.add("autoClip", {
            streamerLogin,
            title,
            m3u8,
            spikeComments: commentCount,
            baselineComments: baseline,
            duration: 15,
          });
        })
        .catch(err => console.error(err));

      commentCount = 0; // reset after queuing
    }
  });

  await chatClient.connect();
  activeStreamers.set(streamerLogin, chatClient);

  return { message: `Started monitoring ${streamerLogin}` };
}

// Optional: stop monitoring
export function stopMonitoringStreamer(streamerLogin) {
  const chatClient = activeStreamers.get(streamerLogin);
  if (chatClient) {
    chatClient.disconnect();
    activeStreamers.delete(streamerLogin);
    return { message: `Stopped monitoring ${streamerLogin}` };
  }
  return { message: `${streamerLogin} was not being monitored` };
}

export const getStreamers = async (req, res) => {
  try {
    const streamers = await Streamer.find({}).select("login -_id");
    const streamerLogins = streamers.map((s) => s.login);
    res.json(streamerLogins.length ? streamerLogins : ["tolzzyyy23"]); // fallback
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

