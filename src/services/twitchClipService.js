// src/services/clipService.js
import Clip from "../models/Clip.js";

/**
 * Save a Twitch clip to MongoDB using `url` as unique key
 */
export const saveTwitchClipToDB = async (clipData) => {
  const {
    title,
    url,
    channel_name,
    start_ts,
    end_ts,
    download_url,
    method = "twitch_api",
  } = clipData;

  if (!title || !url) {
    throw new Error("title and url are required");
  }

  try {
    const clip = await Clip.findOneAndUpdate(
      { url }, // Find by URL
      {
        $set: {
          title,
          channel_name,
          start_ts: start_ts ? new Date(start_ts) : undefined,
          end_ts: end_ts ? new Date(end_ts) : undefined,
          download_url,
          method,
        },
        $setOnInsert: {
          // Only set on first insert
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log(`Saved clip: ${title}`);
    return clip;
  } catch (err) {
    if (err.code === 11000) {
      console.log(`Clip already exists (duplicate URL): ${title}`);
      return null; // Not an error — just skip
    }
    console.error("Error saving clip:", err.message);
    throw err;
  }
};