import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import clipsRoutes from "./routes/clipsRoutes.js";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { verifyTwitchAuth } from "./config/twitch.js";
import { getTwitchToken, refreshTwitchToken } from "./utils/twitchTokenManager.js";
import streamRoutes from "./routes/streamRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import './workers/worker.js';



dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/videos", express.static(path.join(process.cwd(), "public/videos")));





// Connect MongoDB
await connectDB();

if (process.env.NODE_ENV !== "production") {

  app.use("/dev", devRoutes);
}

// Connect Redis
await connectRedis();

// Verify Twitch credentials once at startup
await verifyTwitchAuth();

// 🔁 Auto-refresh Twitch token continuously every 50 minutes
const AUTO_REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minutes in milliseconds

const keepRefreshingTwitchToken = async () => {
  try {
    console.log("🔄 Refreshing Twitch access token...");
    await refreshTwitchToken(); // Refresh token function from utils
    console.log("✅ Twitch token refreshed successfully!");
  } catch (error) {
    console.error("❌ Error refreshing Twitch token:", error.message);
  }
};

// Get an initial token on startup
await getTwitchToken();

// Start auto-refresh loop
setInterval(keepRefreshingTwitchToken, AUTO_REFRESH_INTERVAL);

// Routes
app.use("/api/clips", clipsRoutes);
app.use("/api/stream", streamRoutes);



app.post("/test", (req, res) => {
  console.log("✅ /test route hit");
  res.send("Test route works");
});


// Root route
app.get("/", (req, res) => {
  res.send("🎬 AutoClipper API is running with auto-refresh Twitch tokens!");
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
