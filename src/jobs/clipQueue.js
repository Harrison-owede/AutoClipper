// src/jobs/clipQueue.js
import Queue from "bull";

export const clipQueue = new Queue("clipQueue", process.env.REDIS_URL);
