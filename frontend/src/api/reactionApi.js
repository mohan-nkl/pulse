import client from "./client";

export async function reactToMessage(messageId, emoji) {
    await client.post(`/api/messages/${messageId}/reactions`, { emoji });
}

export async function unreactToMessage(messageId) {
    await client.delete(`/api/messages/${messageId}/reactions`);
}
