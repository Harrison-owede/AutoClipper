import Queue from "bull";

const redisUrl = process.env.REDIS_URL;

export const clipQueue = new Queue("clipQueue", {
  redis: {
    port: 6379,
    host: redisUrl.replace("rediss://", "").split("@")[1].split(":")[0],
    password: redisUrl.split("@")[0].split(":")[2],
    tls: {}, // Upstash requires TLS
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: true,
  },
});

clipQueue.on("ready", () => console.log("🚀 Bull queue ready and connected"));
clipQueue.on("error", (err) =>
  console.error("❌ Bull queue connection error:", err.message)
);

console.log("🎯 clipQueue initialized using secure Upstash Redis (Bull v3)");
