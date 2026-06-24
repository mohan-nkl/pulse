import client from "./client";

// Hide a message for me only.
export async function deleteForMe(messageId) {
    await client.delete(`/api/messages/${messageId}/for-me`);
}

// Delete a message for everyone (sender only, within the time window).
export async function deleteForEveryone(messageId) {
    await client.delete(`/api/messages/${messageId}/for-everyone`);
}

// Edit a message's text (sender only, own text, within 30 minutes).
export async function editMessage(messageId, content) {
    await client.put(`/api/messages/${messageId}`, { content });
}