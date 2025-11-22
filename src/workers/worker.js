// worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import Clip from "../models/clipModel.js";
import "../config/db.js";
import { tmpdir } from "os";
import { join } from "path";
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

// MAIN CLIP FUNCTION — FINAL VERSION
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
    const cmd = `ffmpeg -y -i "${m3u8}" -t ${duration} -c copy "${tempPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || err.message));
        resolve(stdout);
      });
    });

    const safePublicId = title.replace(/[^a-zA-Z0-9_-]/g, "_");

    // FIRE AND FORGET — NO AWAIT, NO RETURN, NO WAIT
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
    .then(() => console.log(`Async upload STARTED: ${safePublicId}`))
    .catch(err => console.error("Upload failed to start:", err.message));

    // INSTANT FEEDBACK TO FRONTEND
    if (global.io) {
      global.io.emit("clip-success", {
        message: `90s RECORDING STARTED → ${streamerLogin.toUpperCase()}`,
        url: null,
        title,
        streamer: streamerLogin,
        duration,
        spike: spikeComments,
        timestamp: new Date().toLocaleString(),
        status: "uploading"
      });
    }

    console.log(`90s clip saved locally: ${tempPath} → upload in background`);
    return `uploaded_async_${safePublicId}`;

  } catch (err) {
    console.error("Live clip error:", err.message);
    console.log(`Failed clip saved at: ${tempPath}`);
    return null;
  }
}

// QUEUE
clipQueue.process("clip", async (job) => processLiveClip(job.data));
clipQueue.process("autoClip", async (job) => processLiveClip(job.data));

// FIXED: "resultado" → "result"
clipQueue.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed → ${result || "no URL"}`);
});

clipQueue.on("failed", (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});