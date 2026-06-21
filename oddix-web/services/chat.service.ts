import { api } from "./api";

export type ChatMode = "safe" | "balanced" | "aggressive";

export async function sendChatMessage(message: string, mode: ChatMode = "balanced") {
  const response = await api.post("/chat-football/message", {
    message,
    mode,
  });

  return response.data;
}