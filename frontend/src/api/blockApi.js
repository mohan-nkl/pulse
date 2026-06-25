import client from "./client";

// Block a user.
export const blockUser = async (userId) => {
    const res = await client.post(`/api/v1/blocks/${userId}`);
    return res.data.data;
};

// Unblock a user.
export const unblockUser = async (userId) => {
    const res = await client.delete(`/api/v1/blocks/${userId}`);
    return res.data.data;
};

// List everyone I've blocked.
export const listBlocked = async () => {
    const res = await client.get("/api/v1/blocks");
    return res.data.data;
};

// Have I blocked this user? -> { blocked: true/false }
export const getBlockStatus = async (userId) => {
    const res = await client.get(`/api/v1/blocks/${userId}/status`);
    return res.data.data;
};