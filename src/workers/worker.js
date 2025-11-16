// worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Clip from "../models/clipModel.js";
import "../config/db.js"; // your main DB connection
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs";
import { exec } from "child_process";
import axios from "axios";
import Queue from "bull";
import { getM3u8Url } from "../utils/m3u8.js";


dotenv.config();

// ---------------------------
// Bull queue (Upstash Redis)
// ---------------------------
export const clipQueue = new Queue("clipQueue", process.env.REDIS_URL, {
  redis: {
    tls: {}, // required for Upstash
  },
});

clipQueue.on("ready", () => console.log("🚀 Bull queue ready"));
clipQueue.on("error", (err) => console.error("❌ Bull queue error:", err.message));

// ---------------------------
// Cloudinary setup
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("🎧 Streamlink clip worker started");

// ---------------------------
// MongoDB connection
// ---------------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker DB connection error:", err.message));

// ---------------------------
// Clip processing function
// ---------------------------
async function processLiveClip(jobData) {
  const { streamerLogin, title, duration = 15, spikeComments, baselineComments } = jobData;
  const safeStreamer = streamerLogin || "example_streamer";

  const tempPath = join(tmpdir(), `${Date.now()}_clip.mp4`);

  try {
    // Check streamlink CLI
    await new Promise((resolve, reject) => {
      exec("which streamlink", (err, stdout) => {
        if (err || !stdout) reject(new Error("Streamlink CLI not installed"));
        resolve(stdout);
      });
    });

    // Record clip
    const m3u8 = await getM3u8Url(safeStreamer);
    if (m3u8 === "offline") {
      console.log(`⚠️ Streamer ${safeStreamer} is offline. Skipping clip.`);
      return null;
    }
    
    // Record via m3u8 (MUCH more stable)
    const cmd = `ffmpeg -i "${m3u8}" -t ${duration} -c copy "${tempPath}"`;
    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
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
      sourceUrl: `https://twitch.tv/${safeStreamer}`,
      createdAt: new Date(),
      spikeComments,
      baselineComments,
      streamerLogin: safeStreamer,
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

// ---------------------------
// Auto spike detection (fully dynamic)
// ---------------------------
const BASE_URL = process.env.BACKEND_URL || "https://autoclipper-shb4.onrender.com";

// Optionally, default streamers if frontend doesn't supply
const STREAMER_LOGIN  = [
  process.env.STREAMER_LOGIN,
  process.env.TWITCH_BROADCASTER,
].filter(Boolean);

setInterval(async () => {
  try {
    // Fetch dynamic streamer list from your API
    const res = await axios.get(`${BASE_URL}/api/streamers`); // you can create this endpoint
    const streamers = Array.isArray(res.data) && res.data.length ? res.data : STREAMER_LOGIN;

    for (const streamerLogin of streamers) {
      try {
        const url = `${BASE_URL}/api/spike?streamer=${streamerLogin}`;
        console.log(`🌐 Checking spike API for ${streamerLogin}: ${url}`);

        const { data } = await axios.get(url);
        const { currentComments, baselineComments } = data;

        if (!data.streamerLogin) {
          console.warn(`⚠️ No streamerLogin returned for ${streamerLogin}`);
          continue;
        }

        if (currentComments >= baselineComments * 5) {
          console.log(`🔥 Spike detected for ${streamerLogin}! Queuing new live clip...`);
          await clipQueue.add("autoClip", {
            streamerLogin,
            title: `AutoClip-${Date.now()}`,
            duration: 15,
            spikeComments: currentComments,
            baselineComments,
          });
        } else {
          console.log(`📊 No spike yet for ${streamerLogin}: ${currentComments}/${baselineComments * 5}`);
        }
      } catch (err) {
        console.error(`⚠️ Spike check failed for ${streamerLogin}:`, err.message);
      }
    }
  } catch (err) {
    console.error("⚠️ Failed to fetch dynamic streamer list:", err.message);
  }
}, 60_000); // check every 60s