import { createClient } from "redis";

let redisClient;

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  // Detect if the URL is for Redis Cloud (rediss://)
  const isCloud = redisUrl.startsWith("rediss://");

  redisClient = createClient({
    url: redisUrl,
    ...(isCloud && {
      socket: {
        tls: true,
        rejectUnauthorized: true, // ✅ must be true for Redis Cloud
      },
    }),
  });

  redisClient.on("error", (err) =>
    console.error("❌ Redis error:", err.message)
  );
  redisClient.on("connect", () => console.log("✅ Redis connected"));

  await redisClient.connect();
  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) throw new Error("Redis not connected yet");
  return redisClient;
};
