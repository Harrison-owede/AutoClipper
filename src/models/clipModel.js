import mongoose from "mongoose";

const clipSchema = new mongoose.Schema({
  title: { type: String, required: true },
  url: { type: String },

  streamerLogin: { type: String, required: true, index: true },
  sourceUrl: { type: String },

  duration: { type: Number, default: 90 },

  cloudinaryPublicId: { 
    type: String, 
    unique: true, 
    sparse: true 
  },

  status: { 
    type: String, 
    enum: ["uploading", "ready", "failed"], 
    default: "uploading",
    index: true          // ← only this one
  },

  spikeComments: Number,
  baselineComments: Number,

  // legacy / optional
  channel_name: String,
  start_ts: Date,
  end_ts: Date,
  download_url: String,
  method: { type: String, default: "streamlink" },

}, { 
  timestamps: true 
});

// Remove ALL these lines below — they are duplicates
// clipSchema.index({ createdAt: -1 });
// clipSchema.index({ streamerLogin: 1, createdAt: -1 });
// clipSchema.index({ status: 1 });

export default mongoose.model("Clip", clipSchema);