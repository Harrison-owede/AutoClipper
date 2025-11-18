// utils/getm3u8.js
import axios from "axios";
import { apiClient } from "../auth/twitch.js";

export async function getM3u8Url(streamerName) {
  try {
    // 1️⃣ Get broadcaster info
    const user = await apiClient.users.getUserByName(streamerName);
    if (!user) return "offline";

    // 2️⃣ Check if they are live
    const stream = await apiClient.streams.getStreamByUserId(user.id);
    if (!stream) return "offline";

    console.log("🔑 Fetching GQL playback token...");

    // 3️⃣ NEW Twitch GraphQL Payload (must be EXACT)
    const payload = [
      {
        operationName: "PlaybackAccessToken",
        variables: {
          isLive: true,
          login: streamerName,
          isVod: false,
          vodID: "",
          playerType: "site"
        },
        extensions: {
          persistedQuery: {
            version: 1,
            sha256Hash:
              "0828119dedeb9099157c2ed0d3f9ef3da9d1f1c9a7e2e5cbf8df23f731ec9f3b"
          }
        }
      }
    ];

    // 4️⃣ Correct headers (your old ones cause 400)
    const gql = await axios.post(
      "https://gql.twitch.tv/gql",
      payload,
      {
        headers: {
          "Client-ID": process.env.TWITCH_CLIENT_ID,
          "Authorization": `Bearer ${process.env.TWITCH_APP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    const token = gql.data[0].data.streamPlaybackAccessToken.value;
    const sig = gql.data[0].data.streamPlaybackAccessToken.signature;

    const m3u8Url =
      `https://usher.ttvnw.net/api/channel/hls/${streamerName}.m3u8` +
      `?sig=${sig}&token=${encodeURIComponent(token)}` +
      `&allow_source=true&allow_audio_only=true`;

    return m3u8Url;

  } catch (err) {
    console.error("❌ Error fetching m3u8:", err.response?.data || err.message);
    return null;
  }
}
