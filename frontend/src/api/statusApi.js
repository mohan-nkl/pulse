import client from "./client";

export const uploadStatusMedia = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await client.post("/api/v1/statuses/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
};

export const createStatus = async ({ content, mediaUrl }) => {
    const response = await client.post("/api/v1/statuses", { content, mediaUrl });
    return response.data.data;
};

export const getMyStatuses = async () => {
    const response = await client.get("/api/v1/statuses/mine");
    return response.data.data;
};

export const getContactStatuses = async () => {
    const response = await client.get("/api/v1/statuses");
    return response.data.data;
};

export const viewStatus = async (statusId) => {
    await client.post(`/api/v1/statuses/${statusId}/view`);
};

export const replyToStatus = async (statusId, content) => {
    const response = await client.post(`/api/v1/statuses/${statusId}/reply`, { content });
    return response.data.data;
};

export const deleteStatus = async (statusId) => {
    await client.delete(`/api/v1/statuses/${statusId}`);
};

export const getStatusViewers = async (statusId) => {
    const response = await client.get(`/api/v1/statuses/${statusId}/viewers`);
    return response.data.data;
};
