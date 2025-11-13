// src/routes/spike.js
import express from "express";
const router = express.Router();

// Example: Simulate random comment spikes
let baselineComments = 50;

router.get("/", async (req, res) => {
  const currentComments = Math.floor(Math.random() * 300);
  const streamerLogin = "tolzzyyy23"; // 👈 Replace with your actual Twitch streamer username

  return res.json({
    currentComments,
    baselineComments,
    streamerLogin,
  });
});

export default router;
