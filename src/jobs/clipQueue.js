import Queue from "bull";
import Redis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

// ✅ Create secure Redis connection for Upstash
const redisClient = new Redis(process.env.REDIS_URL, {
  tls: {}, // required for rediss:// (TLS)
  maxRetriesPerRequest: null, // disables retry limit crash
  connectTimeout: 30000, // 30s timeout for safety
});

redisClient.on("connect", () => console.log("🚀 Redis connection (Bull) established!"));
redisClient.on("error", (err) => console.error("❌ Redis connection error:", err.message));

// ✅ Create Bull queue using the ioredis client
export const clipQueue = new Queue("clipQueue", {
  createClient: (type) => {
    switch (type) {
      case "client":
        return redisClient;
      case "subscriber":
        return redisClient.duplicate();
      default:
        return redisClient;
    }
  },
});

console.log("🎯 clipQueue initialized using secure Upstash Redis (Bull v3)");

