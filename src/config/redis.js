import { createClient } from "redis";

let redisClient;

export const connectRedis = async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("❌ Missing REDIS_URL environment variable");
    process.exit(1);
  }

  const isSecure = redisUrl.startsWith("rediss://");

  redisClient = createClient({
    url: redisUrl,
    socket: isSecure
      ? {
          tls: true,
          rejectUnauthorized: false, // allow Redis Cloud TLS certs
        }
      : {},
  });

  redisClient.on("connect", () => console.log("✅ Redis connected successfully"));
  redisClient.on("error", (err) =>
    console.error("❌ Redis connection error:", err.message)
  );

  try {
    await redisClient.connect();
  } catch (err) {
    console.error("❌ Redis connect() failed:", err.message);
  }

  return redisClient;
};

export const getRedisClient = () => {
  if (!redisClient) throw new Error("Redis not connected yet");
  return redisClient;
};
