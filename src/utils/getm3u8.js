// src/utils/getm3u8.js
import axios from "axios";
import { apiClient } from "../auth/twitch.js";

export async function getM3u8Url(streamerName) {
  try {
    // 1. Validate user
    const user = await apiClient.users.getUserByName(streamerName);
    if (!user) return "offline";

    // 2. Check if live
    const stream = await apiClient.streams.getStreamByUserId(user.id);
    if (!stream) return "offline";

    console.log("🔑 Fetching GQL playback token...");

    // 3. Prepare GQL payload (PlaybackAccessToken)
    const gqlPayload = [{
      operationName: "PlaybackAccessToken",
      variables: {
        isLive: true,
        login: streamerName,
        isVod: false,
        vodID: "",
        playerType: "embed"
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash:
            "0828119d4b9e75f0ac3d2b017c4b8b0d1fe9e6bbb6d6f63adf8853f6a9b12a59"
        }
      }
    }];

    // 4. Call Twitch GQL (Client-ID required)
    const tokenRes = await axios.post("https://gql.twitch.tv/gql", gqlPayload, {
      headers: {
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        "Accept": "application/json",
      },
      timeout: 10000,
    });

    // Defensive checks
    if (!tokenRes?.data?.[0]?.data?.streamPlaybackAccessToken) {
      console.warn("⚠️ GQL token response missing playback token");
      return "offline";
    }

    const access = tokenRes.data[0].data.streamPlaybackAccessToken;
    const sig = access.signature;
    const token = access.value;

    // 5. Build final usher m3u8 URL
    const m3u8Url = `https://usher.ttvnw.net/api/channel/hls/${streamerName}.m3u8?sig=${sig}&token=${encodeURIComponent(
      token
    )}&allow_source=true&allow_audio_only=true`;

    // Optional: quick HEAD/GET sanity check to ensure playlist exists
    try {
      const res = await axios.get(m3u8Url, { timeout: 8000 });
      if (!res.data || !String(res.data).includes("#EXTM3U")) {
        console.warn("⚠️ m3u8 playlist returned but no EXT M3U header");
        return "offline";
      }
    } catch (err) {
      // 404/403 or network error => treat as offline or blocked
      console.warn("⚠️ m3u8 fetch check failed:", err.message);
      return "offline";
    }

    return m3u8Url;
  } catch (err) {
    console.error("❌ Error fetching m3u8:", err.message);
    return null;
  }
}
