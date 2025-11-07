// src/jobs/clipQueue.js
import Queue from "bull";
import dotenv from "dotenv";

dotenv.config();

// ✅ Use Upstash Redis URL with TLS for secure connection
export const clipQueue = new Queue("clipQueue", process.env.REDIS_URL, {
  redis: {
    tls: {}, // important for "rediss://" URLs
  },
});

clipQueue.on("ready", () => {
  console.log("🚀 Bull queue connected to Upstash Redis and ready to process jobs");
});

clipQueue.on("error", (err) => {
  console.error("❌ Bull queue connection error:", err.message);
});

console.log("🎯 clipQueue initialized using secure Upstash Redis (Bull v3)");
