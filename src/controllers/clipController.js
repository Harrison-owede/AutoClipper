// controllers/clipController.js

import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


import Clip from "../models/clipModel.js";
import { clipQueue } from "../jobs/clipQueue.js";


// GET /api/clips → All uploaded clips (newest first)
export const getClips = async (req, res) => {
  try {
    const clips = await Clip.find()
      .sort({ createdAt: -1 })
      .select(
        "title url sourceUrl streamerLogin duration spikeComments baselineComments createdAt"
      )
      .lean();

    // If requested from browser → serve a beautiful HTML gallery

if (req.headers.accept?.includes("text/html")) {
  const page = parseInt(req.query.page) || 1;
  const limit = 12; // 12 clips per page — perfect for mobile
  const skip = (page - 1) * limit;

  const total = await Clip.countDocuments();
  const clips = await Clip.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const totalPages = Math.ceil(total / limit);

  const html = `
<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Clips • Page ${page}</title>
  <style>
    body { margin:0; background:#0e0e10; color:#e4e4e7; font-family:system-ui; padding:15px; }
    h1 { text-align:center; color:#9146ff; margin:0 0 10px; }
    .stats { text-align:center; color:#9146ff; font-size:1.1em; margin-bottom:20px; }
    .grid { display:grid; gap:16px; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); }
    .clip { background:#1a1a1d; border-radius:12px; overflow:hidden; }
    .thumb { width:100%; height:200px; object-fit:cover; background:#000; }
    .info { padding:12px; }
    .title { color:#9146ff; font-weight:bold; margin:0 0 6px; }
    .meta { font-size:0.9em; opacity:0.8; }
    .pagination { text-align:center; margin:30px 0; }
    .pagination button, .pagination a { 
      padding:10px 16px; margin:0 5px; background:#9146ff; color:white; 
      border:none; border-radius:8px; cursor:pointer; text-decoration:none;
    }
    .pagination .current { background:#333; }
  </style>
</head><body>
  <h1>Twitch Auto-Clips</h1>
  <div class="stats">Total: <strong>${total}</strong> clips • Page ${page}/${totalPages || 1}</div>

  <div class="grid">
    ${clips.map(c => `
      <div class="clip" id="clip-${c._id}">
        <img class="thumb" loading="lazy" src="${c.url.replace('.mp4', '.jpg')}" 
             onerror="this.src='https://via.placeholder.com/340x200/333/9146ff?text=${c.streamerLogin}'">
        <div class="info">
          <div class="title">${c.title || c.streamerLogin + " spike"}</div>
          <div class="meta">
            <a href="${c.sourceUrl}" target="_blank">${c.streamerLogin}</a> • 
            ${new Date(c.createdAt).toLocaleDateString()}<br>
            ${c.duration}s • ${c.spikeComments} msgs spike
          </div>
          <button onclick="playClip('${c.url}')" style="margin:8px 0 0; padding:6px 12px; background:#9146ff; color:white; border:none; border-radius:6px;">
            Play
          </button>
          <button onclick="deleteClip('${c._id}')" style="margin:8px 0 0 4px; padding:6px 12px; background:#ff4444; color:white; border:none; border-radius:6px;">
            Delete
          </button>
        </div>
      </div>
    `).join("")}
  </div>

  <div class="pagination">
    ${page > 1 ? `<a href="?page=${page-1}">Previous</a>` : `<span class="current">Previous</span>`}
    <strong>${page}</strong>
    ${page < totalPages ? `<a href="?page=${page+1}">Next</a>` : `<span class="current">Next</span>`}
  </div>

  <script>
    function playClip(url) { window.open(url, "_blank"); }
    async function deleteClip(id) {
      if (!confirm("Delete forever?")) return;
      await fetch("/clips/"+id, {method:"DELETE"});
      document.getElementById("clip-"+id).remove();
    }
  </script>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    socket.on("clip-success", () => location.reload());
  </script>
</body></html>`;
  return res.send(html);
}

    // Otherwise → return clean JSON (for API / frontend apps)
    res.json({
      success: true,
      count: clips.length,
      clips,
    });
  } catch (err) {
    console.error("Get clips error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/clips → Manual clip trigger (optional, for testing)
export const createClip = async (req, res) => {
  try {
    const { streamerLogin, title, duration = 15 } = req.body;

    if (!streamerLogin) {
      return res.status(400).json({ error: "streamerLogin is required" });
    }

    const jobTitle = title || `${streamerLogin}_${Date.now()}`;

    console.log("Manual clip request →", { streamerLogin, jobTitle, duration });

    // Add directly to the same queue your auto-spikes use
    await clipQueue.add("autoClip", {
      streamerLogin,
      title: jobTitle,
      duration,
      spikeComments: "manual",
      baselineComments: "manual",
    });

    res.json({
      success: true,
      message: "Clip job queued!",
      title: jobTitle,
    });
  } catch (err) {
    console.error("Create clip error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE a clip (from Cloudinary + MongoDB)
export const deleteClip = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Clip ID required" });

    const clip = await Clip.findById(id);
    if (!clip) return res.status(404).json({ error: "Clip not found" });

    // Extract public_id from Cloudinary URL
    const publicId = clip.url
      .split("/")
      .slice(-2)
      .join("/")
      .replace(".mp4", "");

    // Delete from Cloudinary
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
    });

    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary delete failed: ${result.result}`);
    }

    // Delete from DB
    await Clip.findByIdAndDelete(id);

    // Real-time update
    if (global.io) global.io.emit("clip-deleted", { id });

    res.json({
      success: true,
      message: "Clip deleted from Cloudinary + DB",
      deletedId: id,
    });
  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({ error: err.message });
  }
};