import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import clipsRoutes from "./routes/clipsRoutes.js";
import { connectDB } from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { verifyTwitchAuth } from "./config/twitch.js";
import { getTwitchToken, initTwitchTokens, refreshTwitchToken, startAutoRefresh} from "./utils/twitchTokenManager.js";
import streamRoutes from "./routes/streamersRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import { clipQueue } from "./jobs/clipQueue.js";
import spikeRoutes from "./routes/spike.js";
import { startChatListener } from "./twitch/chatTracker.js";
import streamersRoutes from "./routes/streamersRoutes.js";







dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use("/videos", express.static(path.join(process.cwd(), "public/videos")));


clipQueue.on("ready", () => console.log("✅ API connected to Redis queue"));
clipQueue.on("error", (err) => console.error("❌ Redis error:", err.message));



// Connect MongoDB
await connectDB();

if (process.env.NODE_ENV !== "production") {

  app.use("/dev", devRoutes);
}

// Connect Redis
await connectRedis();

// Verify Twitch credentials once at startup
await verifyTwitchAuth();
// Start chat listener for your streamer

await initTwitchTokens(); 
startChatListener(process.env.STREAMER_LOGIN);

// Auto-refresh using client_credentials
startAutoRefresh();



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


// Routes
app.use("/api/clips", clipsRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/spike", spikeRoutes);
app.use("/api/streamers", streamersRoutes);





app.post("/test", (req, res) => {
  console.log("✅ /test route hit");
  res.send("Test route works");
});


// Root route
app.get("/", (req, res) => {
  res.send("🎬 AutoClipper API is running with auto-refresh Twitch tokens!");
});


// webhook route – add this anywhere after app = express()
app.post("/webhook/cloudinary", (req, res) => {
  const notification = req.body;

  // Only care about completed eager transformations
  if (notification.notification_type === "eager" && notification.eager) {
    notification.eager.forEach(asset => {
      if (asset.status === "complete" || asset.status === "processing") {
        // Emit to ALL connected browsers
        if (global.io) {
          global.io.emit("clip-success", {
            message: `90s BANGER READY → ${notification.public_id.split("_")[0].toUpperCase()}`,
            url: asset.secure_url || notification.secure_url,
            title: notification.public_id,
            streamer: notification.public_id.split("_")[0],
            duration: 90,
            timestamp: new Date().toLocaleString(),
            isEager: true
          });
        }
      }
    });
  }

  // Always respond 200 so Cloudinary doesn’t retry
  res.status(200).send("OK");
});


// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
