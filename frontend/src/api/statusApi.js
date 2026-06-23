import client from "./client";

// ── Image upload ──────────────────────────────────────────────────────────────
// Call this FIRST when the user picks an image.
// Returns the mediaUrl string to pass into createStatus().
export const uploadStatusMedia = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await client.post("/api/v1/statuses/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data; // the mediaUrl string
};

// ── Create a status ───────────────────────────────────────────────────────────
// Pass { content, mediaUrl } — at least one must be non-null.
// text-only  → { content: "Hello!" }
// image-only → { mediaUrl: "http://..." }
// both       → { content: "caption", mediaUrl: "http://..." }
export const createStatus = async ({ content, mediaUrl }) => {
    const response = await client.post("/api/v1/statuses", { content, mediaUrl });
    return response.data.data; // StatusResponse
};

// ── My own statuses ───────────────────────────────────────────────────────────
// Returns my active statuses with viewCount per item.
export const getMyStatuses = async () => {
    const response = await client.get("/api/v1/statuses/mine");
    return response.data.data; // StatusResponse[]
};

// ── Contact statuses ──────────────────────────────────────────────────────────
// Returns active statuses from all my contacts.
// Each item has viewedByMe: true/false for the unread ring.
export const getContactStatuses = async () => {
    const response = await client.get("/api/v1/statuses");
    return response.data.data; // StatusResponse[]
};

// ── Mark as viewed ────────────────────────────────────────────────────────────
// Idempotent — safe to call multiple times for the same status.
export const viewStatus = async (statusId) => {
    await client.post(`/api/v1/statuses/${statusId}/view`);
};

// ── Reply to a status ─────────────────────────────────────────────────────────
// Sends a DM to the status author. Returns the sent ChatMessageResponse.
export const replyToStatus = async (statusId, content) => {
    const response = await client.post(`/api/v1/statuses/${statusId}/reply`, { content });
    return response.data.data;
};

// ── Delete ────────────────────────────────────────────────────────────────────
// Only works on your own statuses. Backend returns 404 if not yours.
export const deleteStatus = async (statusId) => {
    await client.delete(`/api/v1/statuses/${statusId}`);
};

// ── Viewers list ──────────────────────────────────────────────────────────────
// Returns [ { viewerId, viewerName, viewerAvatarUrl, viewedAt } ]
// Only works if you are the author — backend returns 403 otherwise.
export const getStatusViewers = async (statusId) => {
    const response = await client.get(`/api/v1/statuses/${statusId}/viewers`);
    return response.data.data;
};