import { RefreshingAuthProvider } from "@twurple/auth";
import { ChatClient } from "@twurple/chat";
import fs from "fs";

export const startChatListener = async (streamerLogin) => {
  if (!streamerLogin) return;

  // Load token
  const tokenData = JSON.parse(fs.readFileSync("./tokens.json", "utf8"));
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  const authProvider = new RefreshingAuthProvider(
    { clientId, clientSecret },
    tokenData,
    {
      onRefresh: async (newTokenData) => {
        fs.writeFileSync("./tokens.json", JSON.stringify(newTokenData, null, 2));
        console.log("🔄 Tokens refreshed!");
      },
    }
  );

  // ✅ Add the chat intent to your user token
  await authProvider.addIntentToUser(tokenData.userId, "chat");
  // OR, if you want to add when adding the user:
  // await authProvider.addUserForToken(tokenData, ["chat"]);

  const chat = new ChatClient({
    authProvider,
    channels: [streamerLogin],
    intents: ["chat"]
  });

  await chat.connect();
  console.log(`📡 Connected to Twitch chat for ${streamerLogin}`);
};
