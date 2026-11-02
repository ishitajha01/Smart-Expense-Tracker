import api from "./client";

export const sendAssistantMessage = async (message, conversationId, month, year) => {
  const response = await api.post("ai/chat/", {
    message,
    month,
    year,
    ...(conversationId ? { conversation_id: conversationId } : {}),
  });
  return response.data;
};

export const getAssistantConversations = async () => (await api.get("ai/conversations/")).data;

export const getAssistantConversation = async (id) => (await api.get(`ai/conversations/${id}/`)).data;

export const createAssistantConversation = async () => (await api.post("ai/conversations/")).data;

export const deleteAssistantConversation = async (id) => api.delete(`ai/conversations/${id}/`);
