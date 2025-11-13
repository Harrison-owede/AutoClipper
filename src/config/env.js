// src/config/env.js
import dotenv from "dotenv";
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,

  // PostgreSQL
  MONGO_URI: process.env.MONGO_URI,
 

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",

  // Twitch
  TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
  TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
  TWITCH_ACCESS_TOKEN: process.env.TWITCH_ACCESS_TOKEN,
  TWITCH_REFRESH_TOKEN: process.env.TWITCH_REFRESH_TOKEN,
  TWITCH_USERNAME: process.env.TWITCH_USERNAME,
  TWITCH_BROADCASTER:process.env.TWITCH_BROADCASTER,
  TWITCH_BOT_USERNAME:process.env.TWITCH_BOT_USERNAME,
  TWITCH_BOT_OAUTH:process.env.TWITCH_BOT_OAUTH,


// Cloudinary
CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET


};
