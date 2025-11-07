import { createClient } from "redis";

let redisClient;

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL;

  // Connect WITHOUT TLS (your Redis Cloud instance uses redis://, not rediss://)
  redisClient = createClient({
    url: redisUrl,
    socket: {
      tls: false, // ❌ Disable SSL/TLS
      connectTimeout: 5000,
    },
  });

  redisClient.on("error", (err) => console.error("❌ Redis connection error:", err));
  redisClient.on("connect", () => console.log("✅ Redis connected successfully"));
  redisClient.on("ready", () => console.log("🚀 Redis ready"));

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error("Redis not connected yet");
  }
  return redisClient;
};
