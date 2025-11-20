// utils/getM3u8.js   ← copy-paste this entire file
import axios from "axios";

export async function getM3u8Url(streamerLogin) {
  try {
    // 1. Verify streamer exists + is live (Helix – uses your own Client-ID)
    const appToken = await getAppAccessToken();

    const helixHeaders = {
      "Client-ID": process.env.TWITCH_CLIENT_ID,
      Authorization: `Bearer ${appToken}`,
    };

    const userRes = await axios.get(`https://api.twitch.tv/helix/users?login=${streamerLogin.toLowerCase()}`, { headers: helixHeaders });
    if (!userRes.data.data?.[0]) return "offline";

    const streamRes = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${streamerLogin.toLowerCase()}`, { headers: helixHeaders });
    if (!streamRes.data.data?.[0]) return "offline";

    console.log(`Streamer ${streamerLogin} is LIVE! Fetching playback token...`);

    // 2. GQL – Use persisted query with CORRECT operationName "PlaybackAccessToken" and verified 2025 hash
    const gqlRes = await axios.post("https://gql.twitch.tv/gql", {
      operationName: "PlaybackAccessToken",
      variables: {
        isLive: true,
        login: streamerLogin.toLowerCase(),
        isVod: false,
        vodID: "",
        playerType: "embed"
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: "0828119ded1c13477966434e15800ff57ddacf13ba1911c129dc2200705b0712"
        }
      }
    }, {
      headers: {
        "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Referer": "https://www.twitch.tv/directory/following",
        "Origin": "https://www.twitch.tv",
        "X-Device-Id": "TW96a1b2c3d4e5f6g7h8i9j0k1l2m3n4"
      }
    });

    console.log("GQL Response:", JSON.stringify(gqlRes.data, null, 2));

    if (gqlRes.data.errors) {
      throw new Error(`GQL Errors: ${JSON.stringify(gqlRes.data.errors)}`);
    }

    const tokenData = gqlRes.data.data.streamPlaybackAccessToken;
    if (!tokenData?.value || !tokenData?.signature) {
      throw new Error("No playback token returned");
    }

    const m3u8 = `https://usher.ttvnw.net/api/channel/hls/${streamerLogin.toLowerCase()}.m3u8`
      + `?allow_source=true`
      + `&allow_audio_only=true`
      + `&player=twitchweb`
      + `&sig=${tokenData.signature}`
      + `&token=${encodeURIComponent(tokenData.value)}`
      + `&p=${Math.floor(Math.random() * 9_999_999)}`;

    console.log("m3u8 URL ready → clipping will start now!");
    return m3u8;

  } catch (err) {
    console.error("Failed to get m3u8:", err.response?.data || err.message);
    if (err.response?.status === 400) {
      console.error("400 Bad Request - likely Client-ID issue. Try regenerating your Twitch app.");
    }
    return null;
  }
}

// ——— App Access Token cache (for Helix calls) ———
let cachedToken = null;
let tokenExpiry = 0;

async function getAppAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await axios.post("https://id.twitch.tv/oauth2/token", new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID,
    client_secret: process.env.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials"
  }), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });

  cachedToken = res.data.access_token;
  tokenExpiry = Date.now() + res.data.expires_in * 1000 - 60_000;
  return cachedToken;
}