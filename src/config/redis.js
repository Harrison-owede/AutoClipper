import { createClient } from "redis";

let redisClient;

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL;

  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: true,
      rejectUnauthorized: false,
    },
  });

  redisClient.on("error", (err) => console.error("❌ Redis connection error:", err));
  redisClient.on("connect", () => console.log("✅ Redis connected successfully"));
  redisClient.on("ready", () => console.log("🚀 Redis ready"));

  await redisClient.connect();
  return redisClient;
};
