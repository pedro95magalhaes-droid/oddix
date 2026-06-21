import { api } from "./api";

export type ChatMode = "safe" | "balanced" | "aggressive";

export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
  data?: any;
};

export async function sendChatMessage(
  message: string,
  mode: ChatMode = "balanced",
  history: ChatHistoryMessage[] = [],
) {
  const response = await api.post("/chat-football/message", {
    message,
    mode,
    history,
  });

  return response.data;
}