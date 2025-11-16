// src/models/streamerModel.js
import mongoose from "mongoose";

const streamerSchema = new mongoose.Schema({
  login: { type: String, required: true, unique: true },
  displayName: String,
  twitchId: String,
  // any other fields you want
}, { timestamps: true });

export default mongoose.model("Streamer", streamerSchema);
