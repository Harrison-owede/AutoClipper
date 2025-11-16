// src/routes/spike.js
import express from "express";
import { startChatListener, getChatStats } from "../twitch/chatTracker.js";

const router = express.Router();

/**
 * GET /api/spike?streamer=CHANNEL
 * Returns the current chat spike stats for the requested streamer.
 */
router.get("/", async (req, res) => {
  const streamerLogin = req.query.streamer;

  if (!streamerLogin) {
    return res
      .status(400)
      .json({ error: "Missing ?streamer=CHANNEL query parameter" });
  }

  // Ensure the worker is listening to this streamer's chat
  startChatListener(streamerLogin);

  // Get stats for this streamer
  const stats = getChatStats(streamerLogin);

  return res.json({
    currentComments: stats.count,
    baselineComments: stats.baseline,
    streamerLogin,
  });
});

export default router;
