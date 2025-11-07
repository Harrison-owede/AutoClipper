import { createClient } from "redis";

let redisClient;

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  // Detect if using Redis Cloud (TLS required)
  const useTLS = redisUrl.startsWith("rediss://");

  console.log("🧩 Connecting to Redis:", redisUrl);

  redisClient = createClient({
    url: redisUrl,
    socket: useTLS
      ? {
          tls: true,
          rejectUnauthorized: false,
        }
      : {},
  });

  redisClient.on("connect", () => console.log("✅ Redis connected successfully"));
  redisClient.on("error", (err) => console.error("❌ Redis connection error:", err));

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) throw new Error("Redis not connected yet");
  return redisClient;
};
