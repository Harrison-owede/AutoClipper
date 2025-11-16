// utils/m3u8.js
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_ACCESS_TOKEN = process.env.TWITCH_ACCESS_TOKEN;

// Get the Twitch live m3u8 URL
export async function getM3u8Url(streamerLogin) {
  try {
    // 1️⃣ Get user ID from login
    const userRes = await axios.get(`https://api.twitch.tv/helix/users?login=${streamerLogin}`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}`,
      },
    });

    if (!userRes.data.data || !userRes.data.data.length) return "offline";
    const userId = userRes.data.data[0].id;

    // 2️⃣ Check if the user is live
    const liveRes = await axios.get(`https://api.twitch.tv/helix/streams?user_id=${userId}`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
        Authorization: `Bearer ${TWITCH_ACCESS_TOKEN}`,
      },
    });

    if (!liveRes.data.data || !liveRes.data.data.length) return "offline";

    // 3️⃣ Build the .m3u8 URL
    // Twitch doesn’t directly give m3u8 URLs; we can use the Twitch access token + stream URL
    const tokenRes = await axios.get(`https://api.twitch.tv/api/channels/${streamerLogin}/access_token`, {
      headers: {
        "Client-ID": TWITCH_CLIENT_ID,
      },
    });

    const { sig, token } = tokenRes.data;

    // Construct the HLS m3u8 URL
    const m3u8Url = `https://usher.ttvnw.net/api/channel/hls/${streamerLogin}.m3u8?client_id=${TWITCH_CLIENT_ID}&token=${encodeURIComponent(
      token
    )}&sig=${sig}&allow_source=true&allow_audio_only=true`;

    return m3u8Url;
  } catch (err) {
    console.error(`❌ getM3u8Url error for ${streamerLogin}:`, err.message);
    return "offline";
  }
}
