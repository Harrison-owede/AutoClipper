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
clipQueue.on("ready", () => console.log("Bull queue ready"));
clipQueue.on("error", (err) => console.error("Bull queue error:", err.message));

// ---------------------------
// Cloudinary
// ---------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Streamlink clip worker started");

// ---------------------------
// MongoDB
// ---------------------------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Worker connected to MongoDB"))
  .catch((err) => console.error("Worker DB connection error:", err.message));

// ---------------------------
// FULLY REACTIVE CLIP FUNCTION — 90s + NO AUTO DELETE + FRONTEND ALERT
// ---------------------------
async function processLiveClip(jobData) {
  const {
    streamerLogin,
    title = `${streamerLogin}_${Date.now()}`,
    duration = 90,           // ← 90 seconds by default now
    spikeComments,
    baselineComments
  } = jobData;

  const tempPath = join(tmpdir(), `${Date.now()}_clip.mp4`);

  try {
    console.log("Current Twitch Client-ID:", process.env.TWITCH_CLIENT_ID);
    console.log("Fetching m3u8 for streamer:", streamerLogin);

    const m3u8 = await getM3u8Url(streamerLogin);

    if (!m3u8 || m3u8 === "offline") {
      console.log(`Streamer ${streamerLogin} is offline or m3u8 failed`);
      return null;
    }

    console.log(`Recording ${duration}s clip for ${streamerLogin}...`);
    const cmd = `ffmpeg -y -i "${m3u8}" -t ${duration} -c copy "${tempPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
    });

    const safePublicId = title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const uploadResult = await cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: safePublicId,
      fetch_format: "mp4",
      eager_async: true,
      eager: [
        { streaming_profile: "hd", format: "m3u8" },
        { quality: "auto", fetch_format: "mp4" }
      ],
      // THIS LINE → YOU GET NOTIFIED THE SECOND IT’S DONE
      eager_notification_url: "https://autoclipper-shb4.onrender.com/webhook/cloudinary"
    });

    console.log(`CLIP SUCCESS → ${uploadResult.secure_url}`);

    // Notify frontend in real-time
    if (global.io) {
      global.io.emit("clip-success", {
        message: `SPIKE DETECTED & CLIPPED: ${streamerLogin}`,
        url: uploadResult.secure_url,
        title,
        streamer: streamerLogin,
        duration,
        spike: spikeComments,
        timestamp: new Date().toLocaleString(),
      });
    }

    await Clip.create({
      title,
      url: uploadResult.secure_url,
      sourceUrl: `https://twitch.tv/${streamerLogin}`,
      streamerLogin,
      duration,
      spikeComments,
      baselineComments,
      createdAt: new Date(),
    });

    // LOCAL FILE KEPT ON PURPOSE — YOU DELETE MANUALLY FROM /clips
    console.log(`Local 90s clip saved: ${tempPath} → Keep until you delete from frontend`);

    return uploadResult.secure_url;

  } catch (err) {
    console.error("Live clip error:", err.message);
    console.log(`Failed clip still saved at: ${tempPath} (for inspection)`);
    return null;
  }
}

// ---------------------------
// Queue processors
// ---------------------------
clipQueue.process("clip", async (job) => processLiveClip(job.data));
clipQueue.process("autoClip", async (job) => processLiveClip(job.data));

clipQueue.on("completed", (job, result) => 
  console.log(`Job ${job.id} completed → ${result || "no URL"}`)
);
clipQueue.on("failed", (job, err) => 
  console.error(`Job ${job.id} failed:`, err.message)
);