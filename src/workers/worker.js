// src/workers/worker.js
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import mongoose from "mongoose";
import { clipQueue } from "../jobs/clipQueue.js";
import Clip from "../models/clipModel.js";
import "../config/db.js";
import { tmpdir } from "os";
import { join } from "path";
import fs from "fs";
import { exec } from "child_process";
import axios from "axios";

dotenv.config();

// --- Cloudinary setup ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("🎧 Streamlink clip worker started");

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Worker connected to MongoDB"))
  .catch((err) => console.error("❌ Worker DB connection error:", err.message));

// --- Clip live Twitch stream using Streamlink ---
async function processLiveClip(jobData) {
  const { streamerLogin, title, duration = 15, spikeComments, baselineComments } = jobData;

  try {
    console.log(`🎬 Processing live Twitch clip: ${title}`);

    const tempPath = join(tmpdir(), `${Date.now()}_clip.mp4`);

    // --- Record stream using Streamlink + ffmpeg ---
    // Assumes Streamlink is installed on the server
    // Starts recording 5s before spike
    const cmd = `streamlink --stdout https://twitch.tv/${streamerLogin} best | ffmpeg -y -i - -t ${duration} -c copy "${tempPath}"`;

    await new Promise((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(err);
        resolve(stdout);
      });
    });

    // --- Upload to Cloudinary ---
    const uploadResult = await cloudinary.uploader.upload(tempPath, {
      resource_type: "video",
      folder: "autoclipper_clips",
      public_id: title.replace(/\s+/g, "_"),
      fetch_format: "mp4",
    });

    console.log(`✅ Cloudinary clip ready: ${uploadResult.secure_url}`);

    // --- Save metadata ---
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
    const { data } = await axios.get("https://autoclipper-8.onrender.com/api/comments/spike");
    const { currentComments, baselineComments, streamerLogin } = data;

    if (currentComments >= baselineComments * 5) {
      console.log("🔥 Spike detected! Queuing new live clip...");
      await clipQueue.add("autoClip", {
        streamerLogin,
        title: `AutoClip-${Date.now()}`,
        duration: 15,
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
