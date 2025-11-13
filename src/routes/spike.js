// src/routes/spike.js
import express from "express";
import { getChatStats, startChatListener } from "../twitch/chatTracker.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const streamerLogin = req.query.streamer || process.env.DEFAULT_STREAMER;
  if (!streamerLogin) {
    return res.status(400).json({ error: "Missing ?streamer=CHANNEL or set DEFAULT_STREAMER in env" });
  }

  // ensure we are listening to the streamer's chat
  startChatListener(streamerLogin);

  const stats = getChatStats(streamerLogin);

  return res.json({
    currentComments: stats.count,
    baselineComments: stats.baseline,
    streamerLogin,
  });
});

export default router;
