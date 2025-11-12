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

  try {
    // 🟣 Twitch
    if (url.includes("twitch.tv")) {
      const username = url.split("twitch.tv/")[1].split(/[/?#]/)[0];
      console.log(`🎯 Getting real stream URL for Twitch user: ${username}`);
      const streams = await twitchM3U8.getStream(username);
      if (!streams?.length) throw new Error("No live Twitch stream found");
      realUrl = streams[0].url;
    }

    // 🔴 YouTube
    else if (url.includes("youtube.com") || url.includes("youtu.be")) {
      console.log("🎯 Getting real stream URL for YouTube...");
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        preferFreeFormats: true,
        format: "best[ext=mp4]/best",
        noWarnings: true,
      });

      const formats = info.formats?.filter(
        (f) =>
          f.url?.includes(".m3u8") ||
          f.url?.includes(".mp4") ||
          f.url?.includes(".mpd")
      );

      if (!formats?.length) throw new Error("No playable format found for YouTube");
      const best = formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
      realUrl = best.url;
    }

    // 🟢 Kick
    else if (url.includes("kick.com")) {
      console.log("🎯 Getting real stream URL for Kick...");
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        preferFreeFormats: true,
      });

      const formats = info.formats?.filter((f) =>
        f.url?.includes(".m3u8")
      );

      if (!formats?.length) throw new Error("No HLS format found for Kick");
      realUrl = formats[0].url;
    }

    // Unsupported
    else {
      throw new Error("Unsupported platform — please use Twitch, YouTube, or Kick");
    }

    console.log(`✅ Found real stream: ${realUrl}`);
    console.log("🎬 Capturing lightweight clip...");

    return new Promise((resolve, reject) => {
      ffmpeg(realUrl)
        .addOption("-re") // process slowly, reduce CPU
        .setDuration(duration)
        .videoCodec("libx264") // stable codec
        .audioCodec("aac")
        .size("?480x?") // reduce resolution if needed
        .outputOptions([
          "-preset ultrafast", // faster processing
          "-threads 1", // limit CPU usage
          "-bufsize 512k", // small buffer for Render
          "-maxrate 512k", // bandwidth limit
          "-movflags +faststart", // better streamability
        ])
        .on("end", () => {
          console.log(`✅ Clip saved locally: ${outputFile}`);
          resolve(outputFile);
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err.message);
          reject(err);
        })
        .save(outputFile);
    });
  } catch (err) {
    console.error("❌ Worker error:", err.message);
    throw err;
  }
};
