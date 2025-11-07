import { createClient } from "redis";

let redisClient;

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  // Detect Redis Cloud (uses rediss://)
  const isCloud = redisUrl.startsWith("rediss://");

  redisClient = createClient({
    url: redisUrl,
    socket: isCloud
      ? {
          tls: true, // ✅ important for Redis Cloud
          rejectUnauthorized: false, // skip strict SSL checks
        }
      : {
          tls: false, // local Redis (no TLS)
        },
  });

  redisClient.on("error", (err) =>
    console.error("❌ Redis connection error:", err.message)
  );

  redisClient.on("connect", () => console.log("✅ Redis connected successfully"));

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error("Redis not connected yet");
  }
  return redisClient;
};
