import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import clipsRoutes from "./routes/clipsRoutes.js";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { verifyTwitchAuth } from "./config/twitch.js";
import { initTwitchTokens, startAutoRefresh } from "./utils/twitchTokenManager.js";
import streamRoutes from "./routes/streamersRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import { clipQueue } from "./jobs/clipQueue.js";
import spikeRoutes from "./routes/spike.js";
import { startChatListener } from "./twitch/chatTracker.js";
import streamersRoutes from "./routes/streamersRoutes.js"; // Keep one
import cloudinaryWebhook from "./routes/webhook/cloudinary.js";
import testClips from "./routes/testClips.js";
import { startYouTubeMonitoring } from "./workers/youtubeChatWorker.js";
import { startKickMonitoring } from "./workers/kickChatWorker.js";

import Clip from "./models/clipModel.js"; // For webhook

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: "*", // Or specific frontend URL in production, e.g., "http://localhost:5173"
  credentials: true
}));
app.use(express.json());
app.use("/videos", express.static(path.join(process.cwd(), "public/videos")));

// Queue events
clipQueue.on("ready", () => console.log("✅ API connected to Redis queue"));
clipQueue.on("error", (err) => console.error("❌ Redis error:", err.message));

// Routes (must be before app.listen)
app.use("/api/clips", clipsRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/spike", spikeRoutes);
app.use("/api/streamers", streamersRoutes);
app.use("/", cloudinaryWebhook);
app.use("/", testClips);

if (process.env.NODE_ENV !== "production") {
  app.use("/dev", devRoutes);
}

app.post("/test", (req, res) => {
  console.log("/test route hit");
  res.send("Test route works");
});

app.get("/", (req, res) => {
  res.send("AutoClipper API is running!");
});

// Start server + async startup
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");

    await connectRedis();
    console.log("✅ Redis connected");

    await verifyTwitchAuth();
    await initTwitchTokens();

    // Start monitoring
    startChatListener(process.env.STREAMER_LOGIN || "tolzzyyy23");
    startYouTubeMonitoring("UC_x5XG1OV2P6uZZ5FSM9Ttw"); // Example YouTube
    startKickMonitoring("adinross"); // Change to your Kick channel slug

    startAutoRefresh(); // Twitch token refresh

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Startup failed:", err.message);
    process.exit(1);
  }
};

startServer();