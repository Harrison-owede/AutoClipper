// src/workers/worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Clip from "../models/clipModel.js"; // adjust path if needed
import "../config/db.js";
import { join } from "path";
import { tmpdir } from "os";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { getM3u8Url } from "../utils/getm3u8.js"; // not needed anymore but keep if you want
import { clipQueue } from "../jobs/clipQueue.js";

const execAsync = promisify(exec);

dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Streamlink clip worker started — READY TO RECORD BANGERS");

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Worker → MongoDB connected"))
  .catch(err => console.error("Worker DB error:", err));

async function processLiveClip(jobData) {
  const {
    streamerLogin,
    title = `${streamerLogin}_${Date.now()}`,
    duration = 90,
    spikeComments,
    baselineComments
  } = jobData;

  const tempPath = join(tmpdir(), `${Date.now()}_clip.mp4`);

  try {
    console.log(`Recording ${duration}s clip → ${streamerLogin}`);

    // THIS IS THE MAGIC COMMAND — 100% RELIABLE ON TWITCH
    const cmd = [
      "streamlink",
      "--twitch-disable-ads",
      "--twitch-disable-reruns",
      "--hls-duration", duration.toString(),
      "--output", tempPath,
      `twitch.tv/${streamerLogin}`,
      "best"
    ].join(" ");

    console.log("Running:", cmd);

    const { stderr } = await execAsync(cmd, { timeout: 180000 }); // 3 min max

    if (stderr && !stderr.includes("Writing output to")) {
      console.warn("Streamlink warning:", stderr);
    }

    // Validate file
    if (!fs.existsSync(tempPath)) {
      throw new Error("Streamlink did not create output file");
    }

    const stats = fs.statSync(tempPath);
    console.log(`Clip recorded! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    if (stats.size < 8 * 1024 * 1024) {
      throw new Error(`Clip too small (${(stats.size / 1024 / 1024).toFixed(2)} MB) — probably offline or ad`);
    }

    const safePublicId = title.replace(/[^a-zA-Z0-9_-]/g, "_");

    // Upload to Cloudinary (fire and forget)
    cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: safePublicId,
      format: "mp4",
      eager: [{ streaming_profile: "hd", format: "m3u8" }],
      eager_async: true,
      eager_notification_url: "https://autoclipper-shb4.onrender.com/webhook/cloudinary"
    })
    .then(() => console.log(`Cloudinary upload started → ${safePublicId}`))
    .catch(err => console.error("Cloudinary upload failed:", err.message));

    // Optional: Emit to frontend via Socket.IO
    if (global.io) {
      global.io.emit("clip-success", {
        message: `BANGER CLIP RECORDED → ${streamerLogin.toUpperCase()}`,
        title,
        streamer: streamerLogin,
        duration,
        spike: spikeComments,
        timestamp: new Date().toLocaleString(),
        status: "uploading"
      });
    }

    console.log(`SUCCESS → ${streamerLogin} 90s clip ready`);
    return `uploaded_async_${safePublicId}`;

  } catch (error) {
    console.error(`FAILED → ${streamerLogin}:`, error.message);
    if (fs.existsSync(tempPath)) {
      const size = fs.statSync(tempPath).size;
      console.log(`Failed clip saved anyway: ${tempPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    }
    return null;
  } finally {
    // Optional: clean up temp file after 10 seconds
    setTimeout(() => {
      if (fs.existsSync(tempPath)) fs.unlink(tempPath, () => {});
    }, 10000);
  }
}

// Process both job types
clipQueue.process("clip", async (job) => await processLiveClip(job.data));
clipQueue.process("autoClip", async (job) => await processLiveClip(job.data));

clipQueue.on("completed", (job) => console.log(`Job ${job.id} completed`));
clipQueue.on("failed", (job, err) => console.error(`Job ${job.id} failed:`, err.message));