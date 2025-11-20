// routes/clipRoutes.js
import express from "express";
import { getClips, createClip } from "../controllers/clipController.js";

const router = express.Router();

router.get("/clips", getClips);        // → https://yoursite.com/clips (HTML + JSON)
router.post("/clips", createClip);     // → manual trigger endpoint

export default router;