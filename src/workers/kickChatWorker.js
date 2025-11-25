// src/workers/kickChatWorker.js
import KickStreamChat from "kick-stream-chat";
import { clipQueue } from "../jobs/clipQueue.js";

let kickChat;

export const startKickMonitoring = (username) => {
  try {
    kickChat = new KickStreamChat(username);

    kickChat.on("message", (message) => {
      // Spike detection (use your counter logic)
      const messageCount = 1;  // Increment global message counter here

      if (messageCount > 50) {  // Threshold for spike
        console.log(`KICK SPIKE → ${username} (${messageCount} msgs)`);
        clipQueue.add("clip", {
          platform: "kick",
          streamerLogin: username,
          title: `kick_spike_${Date.now()}`,
          duration: 90,
          spikeComments: messageCount
        });
      }
    });

    kickChat.connect();
    console.log(`Kick monitoring started → ${username}`);

  } catch (err) {
    console.error("Kick chat init error:", err.message);
  }
};

export const stopKickMonitoring = () => {
  if (kickChat) {
    kickChat.disconnect();
    kickChat = null;
    console.log("Kick monitoring stopped");
  }
};