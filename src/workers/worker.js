// worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Clip from "../models/clipModel.js";
import "../config/db.js";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs";
import { exec } from "child_process";
import axios from "axios";
import Queue from "bull";
import { getM3u8Url } from "../utils/getm3u8.js";
import { clipQueue } from "../jobs/clipQueue.js";
import { apiClient } from "../auth/twitch.js";



dotenv.config();

// ---------------------------
// Bull queue
// ---------------------------


clipQueue.on("ready", () => console.log("🚀 Bull queue ready"));
clipQueue.on("error", (err) => console.error("❌ Bull queue error:", err.message));

// ---------------------------
// Cloudinary
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("🎧 Streamlink clip worker started");

// ---------------------------
// MongoDB
// ---------------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker DB connection error:", err.message));

// ---------------------------
// Fully reactive clip function
// ---------------------------
async function processLiveClip(jobData) {
  const { streamerLogin, title, duration = 15, spikeComments, baselineComments } = jobData;
  const tempPath = join(tmpdir(), `${Date.now()}_clip.mp4`);

  try {
    // 1️⃣ Check if Streamlink/FFmpeg is installed
    await new Promise((resolve, reject) => {
      exec("which ffmpeg", (err, stdout) => {
        if (err || !stdout) reject(new Error("FFmpeg CLI not installed"));
        resolve(stdout);
      });
    });

    // 2️⃣ Wait until spike happens
 

    // 3️⃣ Get live m3u8 URL
    const m3u8 = await getM3u8Url(streamerLogin);
    if (m3u8 === "offline") {
      console.log(`⚠️ Streamer ${streamerLogin} went offline. Skipping clip.`);
      return null;
    }

    // 4️⃣ Record the spike clip
    const cmd = `ffmpeg -y -i "${m3u8}" -t ${duration} -c copy "${tempPath}"`;
    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
    });

    // 5️⃣ Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: title.replace(/\s+/g, "_"),
      fetch_format: "mp4",
    });
    console.log(`✅ Cloudinary clip ready: ${uploadResult.secure_url}`);

    // 6️⃣ Save metadata
    await Clip.create({
      title,
      url: uploadResult.secure_url,
      sourceUrl: `https://twitch.tv/${streamerLogin}`,
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
    return null;
  }
}

// ---------------------------
// Queue processors
// ---------------------------
clipQueue.process("clip", async (job) => processLiveClip(job.data));
clipQueue.process("autoClip", async (job) => processLiveClip(job.data));

clipQueue.on("completed", (job, result) => console.log(`✅ Job ${job.id} completed → ${result}`));
clipQueue.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed:`, err.message));
