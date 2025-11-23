// routes/webhook/cloudinary.js
import express from "express";
import Clip from "../../models/clipModel.js";

const router = express.Router();

// FIX: Handle BOTH raw body (string) AND pre-parsed body (object)
router.post("/webhook/cloudinary", (req, res) => {
  let event;
  
  try {
    // If req.body is already an object (auto-parsed), use it directly
    if (typeof req.body === "object" && req.body !== null) {
      event = req.body;
    } else {
      // Otherwise, parse as JSON string
      event = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    }
  } catch (parseErr) {
    console.error("Webhook parse error:", parseErr.message);
    return res.status(400).send("Invalid JSON");
  }

  // Now process the event (works for both upload and eager notifications)
  if (event.notification_type === "upload" || event.notification_type === "eager") {
    const publicId = event.public_id; // e.g. "autoclipper_clips/marlon_123456"
    const url = event.secure_url || event.url;

    // Update the clip in DB (only if it exists, no upsert)
    Clip.findOneAndUpdate(
      { cloudinaryPublicId: publicId },
      {
        url: url,
        status: "ready"
      },
      { new: true }
    )
    .then(updatedClip => {
      if (updatedClip) {
        console.log(`CLIP READY → ${publicId} | ${url}`);
        
        // Optional: Notify frontend
        if (global.io) {
          global.io.emit("clip-ready", {
            id: updatedClip._id,
            url: url,
            title: updatedClip.title,
            streamer: updatedClip.streamerLogin
          });
        }
      } else {
        console.warn(`No clip found for publicId: ${publicId}`);
      }
    })
    .catch(err => {
      console.error("DB update error:", err.message);
    });
  }

  // Always respond 200 immediately — Cloudinary retries on failure
  res.status(200).send("OK");
});

export default router;