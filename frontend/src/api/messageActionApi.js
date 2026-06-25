import client from "./client";

export async function deleteForMe(messageId) {
    await client.delete(`/api/messages/${messageId}/for-me`);
}

export async function deleteForEveryone(messageId) {
    await client.delete(`/api/messages/${messageId}/for-everyone`);
}

export async function editMessage(messageId, content) {
    await client.put(`/api/messages/${messageId}`, { content });
}
