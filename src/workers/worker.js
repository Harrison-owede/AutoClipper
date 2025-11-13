// src/workers/worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import { clipQueue } from "../jobs/clipQueue.js";
import Clip from "../models/clipModel.js";
import "../config/db.js";
import fs from "fs";
import { tmpdir } from "os";
import { join } from "path";
import ffmpeg from "fluent-ffmpeg";
import { ApiClient } from "twitch";
import { ClientCredentialsAuthProvider } from "twitch-auth";

dotenv.config();

// --- Cloudinary setup ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("🎧 Cloudinary clip worker started");

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker DB connection error:", err.message));

// --- Twitch API setup ---
const authProvider = new ClientCredentialsAuthProvider(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_CLIENT_SECRET
);
const twitchClient = new ApiClient({ authProvider });

// --- Get signed HLS URL ---
async function getSignedHLS(streamerLogin) {
  // Fetch live stream info
  const stream = await twitchClient.helix.streams.getStreamByUserName(streamerLogin);
  if (!stream) throw new Error(`${streamerLogin} is not live`);

  // Get m3u8 playlist URL (signed)
  const channel = await twitchClient.helix.channels.getChannelInfoById(stream.userId);
  const hlsUrl = `https://usher.ttvnw.net/api/channel/hls/${streamerLogin}.m3u8?client_id=${process.env.TWITCH_CLIENT_ID}&token=${encodeURIComponent(stream.token)}&sig=${stream.sig}&allow_source=true`;
  return hlsUrl;
}

// --- Clip live Twitch stream ---
async function processLiveClip(jobData) {
  const {
    streamerLogin,
    title,
    duration = 120,
    spikeComments,
    baselineComments,
  } = jobData;

  try {
    console.log(`🎬 Processing live Twitch clip: ${title}`);

    const hlsUrl = await getSignedHLS(streamerLogin);
    console.log("🔗 HLS Stream URL:", hlsUrl);

    const tempPath = join(tmpdir(), `${Date.now()}_clip.mp4`);

    // Record clip using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(hlsUrl)
        .setStartTime(0) // You can adjust for 5s pre-spike if using buffer
        .setDuration(duration)
        .output(tempPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: title.replace(/\s+/g, "_"),
      fetch_format: "mp4",
    });

    console.log(`✅ Cloudinary clip ready: ${uploadResult.secure_url}`);

    // Save metadata
    await Clip.create({
      title,
      url: uploadResult.secure_url,
      sourceUrl: hlsUrl,
      createdAt: new Date(),
      spikeComments,
      baselineComments,
      streamerLogin,
      duration,
    });

    fs.unlinkSync(tempPath);
    return uploadResult.secure_url;
  } catch (err) {
    console.error("❌ Live clip error:", err.message);
    throw err;
  }
}

// --- Queue processors ---
clipQueue.process("clip", async (job) => processLiveClip(job.data));
clipQueue.process("autoClip", async (job) => processLiveClip(job.data));

clipQueue.on("completed", (job, result) => {
  console.log(`✅ Job ${job.id} completed → ${result}`);
});

clipQueue.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});

// --- Auto spike detection ---
setInterval(async () => {
  try {
    const { data } = await axios.get(
      "https://autoclipper-8.onrender.com/api/comments/spike"
    );
    const { currentComments, baselineComments, streamerLogin } = data;

    if (currentComments >= baselineComments * 5) {
      console.log("🔥 Spike detected! Queuing new live clip...");
      await clipQueue.add("autoClip", {
        streamerLogin,
        title: `AutoClip-${Date.now()}`,
        duration: 120,
        spikeComments: currentComments,
        baselineComments,
      });
    } else {
      console.log(`📊 No spike yet: ${currentComments}/${baselineComments * 5}`);
    }
  } catch (err) {
    console.error("⚠️ Spike check failed:", err.message);
  }
}, 60_000);
