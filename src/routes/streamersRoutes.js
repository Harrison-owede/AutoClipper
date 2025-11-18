import express from "express";
import { 
  startMonitoringStreamer, 
  stopMonitoringStreamer,   // ✅ ADD THIS
  getStreamers 
} from "../controllers/streamersController.js";


const router = express.Router();

router.post("/watch", async (req, res) => {
  const { streamerLogin } = req.body;
  if (!streamerLogin) return res.status(400).json({ message: "streamerLogin required" });

  try {
    const result = await startMonitoringStreamer(streamerLogin);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/stop", async (req, res) => {
  const { streamerLogin } = req.body;
  if (!streamerLogin) return res.status(400).json({ message: "streamerLogin required" });

  try {
    const result = stopMonitoringStreamer(streamerLogin);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/streamers → returns a list of streamers
router.get("/", getStreamers);

export default router;
