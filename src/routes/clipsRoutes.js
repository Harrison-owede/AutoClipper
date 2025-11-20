// routes/clipRoutes.js
import express from "express";
import { getClips, createClip } from "../controllers/clipController.js";  // ← removed the "s"

const router = express.Router();

router.get("/clips", getClips);
router.post("/clips", createClip);

export default router;