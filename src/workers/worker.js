// src/workers/worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import m3u8stream from "m3u8stream";
import fs from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { clipQueue } from "../jobs/clipQueue.js";
import Clip from "../models/clipModel.js";
import "../config/db.js";

dotenv.config();

// --- Cloudinary setup ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("🎧 Cloudinary clip worker started");

// --- Mongo connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker DB connection error:", err.message));

// --- Helper: get Twitch HLS URL ---
// --- Clip live stream and upload to Cloudinary ---
async function processLiveClip(jobData) {
  const { streamerName, title, duration = 15 } = jobData;

  try {
    console.log(`🎬 Processing live Twitch clip for: ${title}`);

    const hlsUrl = await getLiveStreamHLS(streamerName);
    console.log("🔗 HLS Stream URL:", hlsUrl);

    const tempOutputPath = join(tmpdir(), `${Date.now()}_liveclip.mp4`);

    // --- Clip start time: 5 seconds before spike ---
    const startTime = -5; // negative means start 5 seconds earlier if possible

    await new Promise((resolve, reject) => {
      const stream = m3u8stream(hlsUrl, { start: startTime > 0 ? startTime : 0 });
      ffmpeg(stream)
        .setStartTime(startTime > 0 ? startTime : 0)
        .setDuration(duration)
        .output(tempOutputPath)
        .on("end", resolve)
        .on("error", reject)
        .run();
    });

    // --- Upload trimmed clip to Cloudinary ---
    const uploadResult = await cloudinary.uploader.upload(tempOutputPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: title.replace(/\s+/g, "_"),
      fetch_format: "mp4",
    });

    console.log(`✅ Cloudinary clip ready: ${uploadResult.secure_url}`);

    // --- Save to DB ---
    await Clip.create({
      title,
      url: uploadResult.secure_url,
      sourceUrl: hlsUrl,
      createdAt: new Date(),
    });

    // --- Clean up temp file ---
    fs.unlinkSync(tempOutputPath);

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

// --- Auto-trigger spike detection every 60s ---
setInterval(async () => {
  try {
    const { data } = await axios.get(
      "https://autoclipper-8.onrender.com/api/comments/spike"
    );
    const { currentComments, baselineComments, streamerName } = data;

    if (currentComments >= baselineComments * 5) {
      console.log("🔥 Spike detected! Queuing new live clip...");
      await clipQueue.add("autoClip", {
        streamerName,
        title: `AutoClip-${Date.now()}`,
        duration: 15,
      });
    } else {
      console.log(`📊 No spike yet: ${currentComments}/${baselineComments * 5}`);
    }
  } catch (err) {
    console.error("⚠️ Spike check failed:", err.message);
  }
}, 60_000);
