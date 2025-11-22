// worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Clip from "../models/clipModel.js";
import "../config/db.js";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs"; // ← ADD THIS IMPORT
import { exec } from "child_process";
import { getM3u8Url } from "../utils/getm3u8.js";
import { clipQueue } from "../jobs/clipQueue.js";

dotenv.config();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Streamlink clip worker started");

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("Worker connected to MongoDB"))
  .catch(err => console.error("Worker DB error:", err.message));

// MAIN CLIP FUNCTION — FINAL UNBREAKABLE VERSION
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
    console.log("Fetching m3u8 for streamer:", streamerLogin);
    const m3u8 = await getM3u8Url(streamerLogin);

    if (!m3u8 || m3u8 === "offline") {
      console.log(`Streamer ${streamerLogin} is offline`);
      return null;
    }

    console.log(`Recording ${duration}s clip for ${streamerLogin}...`);

    // BULLETPROOF FFMPEG COMMAND
    const cmd = `ffmpeg -y -fflags +genpts -i "${m3u8}" -t ${duration} -c copy -avoid_negative_ts make_zero -bsf:a aac_adtstoasc "${tempPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err || stderr?.includes("Invalid data") || stderr?.includes("401")) {
          console.error("FFmpeg FAILED:", stderr || err);
          return reject(new Error("FFmpeg failed to record stream"));
        }
        console.log("FFmpeg SUCCESS — clip recorded");
        resolve();
      });
    });

    // VALIDATE FILE EXISTS AND IS BIG ENOUGH
    if (!fs.existsSync(tempPath)) {
      throw new Error("Clip file was not created");
    }

    const stats = fs.statSync(tempPath);
    console.log(`Clip size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    if (stats.size < 10 * 1024 * 1024) { // less than ~10MB = bad clip
      throw new Error(`Clip too small (${(stats.size / 1024 / 1024).toFixed(2)} MB) — likely encrypted or failed stream`);
    }

    const safePublicId = title.replace(/[^a-zA-Z0-9_-]/g, "_");

    // FIRE AND FORGET UPLOAD — WITH PROPER ERROR LOGGING
    cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: safePublicId,
      fetch_format: "mp4",
      eager_async: true,
      eager: [
        { streaming_profile: "hd", format: "m3u8" },
        { quality: "auto", fetch_format: "mp4" }
      ],
      eager_notification_url: "https://autoclipper-shb4.onrender.com/webhook/cloudinary"
    })
    .then(() => {
      console.log(`CLOUDINARY UPLOAD STARTED → ${safePublicId}`);
    })
    .catch(err => {
      console.error("CLOUDINARY UPLOAD FAILED:", err.message || JSON.stringify(err));
    });

    // INSTANT FEEDBACK TO FRONTEND
    if (global.io) {
      global.io.emit("clip-success", {
        message: `90s BANGER RECORDING → ${streamerLogin.toUpperCase()}`,
        url: null,
        title,
        streamer: streamerLogin,
        duration,
        spike: spikeComments,
        timestamp: new Date().toLocaleString(),
        status: "uploading"
      });
    }

    console.log(`90s clip saved locally: ${tempPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB) → upload in background`);
    return `uploaded_async_${safePublicId}`;

  } catch (err) {
    console.error("LIVE CLIP ERROR:", err.message);
    if (fs.existsSync(tempPath)) {
      const size = fs.statSync(tempPath).size;
      console.log(`Failed clip still saved: ${tempPath} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    }
    return null;
  }
}

// QUEUE
clipQueue.process("clip", async (job) => processLiveClip(job.data));
clipQueue.process("autoClip", async (job) => processLiveClip(job.data));

clipQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed → ${result || "no URL"}`);
});

clipQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});