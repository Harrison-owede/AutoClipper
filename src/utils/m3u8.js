// utils/m3u8.js
import axios from "axios";

export const getM3u8Url = async (streamerLogin) => {
  try {
    // Twitch undocumented API (but stable)
    const url = `https://usher.ttvnw.net/api/channel/hls/${streamerLogin}.m3u8`;

    const { data } = await axios.get(url, {
      params: {
        player: "twitchweb",
        type: "any",
        allow_source: "true",
        allow_audio_only: "true",
        fast_bread: "true"
      },
      headers: {
        // Twitch requires random token to bypass CORS blocks
        "Client-ID": process.env.TWITCH_CLIENT_ID,
        "Accept": "*/*",
      }
    });

    if (!data || !data.includes("#EXTM3U")) {
      return "offline";
    }

    return url;
  } catch (error) {
    return "offline";
  }
};
