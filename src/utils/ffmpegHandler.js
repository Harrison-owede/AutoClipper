import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import twitchM3U8 from "twitch-m3u8";
import youtubedl from "youtube-dl-exec";

ffmpeg.setFfmpegPath(ffmpegPath);

export const captureClip = async (url, outputDir, duration = 10) => {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `clip-${Date.now()}.mp4`);

  let realUrl;

  // Twitch only (for now)
  if (url.includes("twitch.tv")) {
    const username = url.split("twitch.tv/")[1].split(/[/?#]/)[0];
    console.log(`🎯 Getting real stream URL for Twitch user: ${username}`);
    const streams = await twitchM3U8.getStream(username);
    if (!streams?.length) throw new Error("No live Twitch stream found");
    // pick lowest quality to reduce memory
    realUrl = streams[streams.length - 1].url;
  } else {
    throw new Error("Only Twitch supported in Render safe mode");
  }

  console.log(`✅ Found real stream: ${realUrl}`);
  console.log("🎬 Capturing lightweight clip...");

  return new Promise((resolve, reject) => {
    ffmpeg(realUrl)
      .inputOptions(["-re", "-tune", "zerolatency"])
      .outputOptions([
        "-t", String(duration),
        "-c:v", "copy",
        "-c:a", "aac",
        "-threads", "1",
        "-bufsize", "256k",
        "-maxrate", "256k",
        "-vf", "scale=-1:360", // downscale to 360p
        "-movflags", "+faststart"
      ])
      .on("end", () => {
        console.log(`✅ Clip saved: ${outputFile}`);
        resolve(outputFile);
      })
      .on("error", (err) => {
        console.error("❌ FFmpeg error:", err.message);
        reject(err);
      })
      .save(outputFile);
  });
};
