// controllers/clipController.js
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
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>My Auto-Clips • ${clips.length} clips</title>
  <style>
    body { margin:0; background:#0e0e10; color:#e4e4e7; font-family:system-ui,sans-serif; padding:20px; }
    h1 { text-align:center; color:#9146ff; }
    .stats { text-align:center; font-size:1.4em; margin:20px; color:#9146ff; }
    .grid { display:grid; gap:20px; grid-template-columns:repeat(auto-fill,minmax(380px,1fr)); max-width:1400px; margin:0 auto; }
    .clip { background:#1a1a1d; border-radius:12px; overflow:hidden; box-shadow:0 8px 32px rgba(145,70,255,0.15); }
    video { width:100%; height:214px; object-fit:cover; background:#000; }
    .info { padding:14px; }
    .title { font-weight:bold; color:#9146ff; margin:0 0 8px; font-size:1.1em; }
    .meta { font-size:0.9em; opacity:0.85; line-height:1.5; }
    a { color:#9146ff; text-decoration:none; }
    a:hover { text-decoration:underline; }
    .empty { text-align:center; padding:60px; font-size:1.3em; opacity:0.6; }
  </style>
</head>
<body>
  <h1>Twitch Auto-Clipper</h1>
  <div class="stats">Total clips: <strong>${clips.length}</strong></div>

  ${clips.length === 0
    ? `<div class="empty">No clips yet. Waiting for the next spike...</div>`
    : `<div class="grid">
        ${clips
          .map(
            (c) => `
          <div class="clip">
            <video controls preload="metadata" poster="${c.url.replace(".mp4", ".jpg")}">
              <source src="${c.url}#t=0.1" type="video/mp4" />
            </video>
            <div class="info">
              <div class="title">${c.title || c.streamerLogin + " spike"}</div>
              <div class="meta">
                <a href="${c.sourceUrl}" target="_blank">${c.streamerLogin}</a><br>
                ${new Date(c.createdAt).toLocaleString()}<br>
                Duration: ${c.duration}s | Spike: ${c.spikeComments} msgs (baseline: ${c.baselineComments})
              </div>
            </div>
          </div>`
          )
          .join("")}
      </div>`
  }
</body>
</html>`;

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