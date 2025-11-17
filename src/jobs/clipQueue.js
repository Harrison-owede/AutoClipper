// src/jobs/clipQueue.js
import Queue from "bull";
import dotenv from "dotenv";
dotenv.config();

export const clipQueue = new Queue("clipQueue", process.env.REDIS_URL, {
  // Bull options (optional)
  redis: {
    tls: {}, // necessary for Upstash
  },
});

clipQueue.on("ready", () => {
  console.log("🚀 Bull queue connected to Upstash Redis and ready");
});

clipQueue.on("error", (err) => {
  console.error("❌ Bull queue error:", err.message);
});
