// src/routes/streamers.js
import express from "express";

const router = express.Router();

// Optional: default streamers from environment variables
const DEFAULT_STREAMERS = [
  process.env.DEFAULT_STREAMER,
  process.env.TWITCH_BROADCASTER,
].filter(Boolean);

/**
 * GET /api/streamers
 * Returns the list of streamers to monitor.
 * Frontend can optionally send a ?streamers=comma,separated,list to override defaults
 */
router.get("/", (req, res) => {
  const { streamers } = req.query;

  if (streamers) {
    // Frontend provided a dynamic list, split by comma
    const list = streamers.split(",").map(s => s.trim()).filter(Boolean);
    return res.json(list);
  }

  // Otherwise return defaults
  return res.json(DEFAULT_STREAMERS);
});

export default router;
