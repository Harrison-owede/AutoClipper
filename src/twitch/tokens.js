import { RefreshingAuthProvider } from "@twurple/auth";
import fs from "fs";

export const loadAuthProvider = () => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  let tokenData = JSON.parse(fs.readFileSync("./tokens.json", "utf8"));

  const authProvider = new RefreshingAuthProvider(
    {
      clientId,
      clientSecret,
      onRefresh: async (newTokenData) => {
        console.log("🔄 Tokens refreshed automatically!");
        fs.writeFileSync("./tokens.json", JSON.stringify(newTokenData, null, 2));
      },
    },
    tokenData
  );

  return authProvider;
};
