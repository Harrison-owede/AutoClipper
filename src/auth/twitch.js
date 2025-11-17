import { ApiClient } from "@twurple/api";
import { AppTokenAuthProvider } from "@twurple/auth";

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;

const authProvider = new AppTokenAuthProvider(clientId, clientSecret);

export const apiClient = new ApiClient({ authProvider });
