import client from "./client";

export const blockUser = async (userId) => {
    const res = await client.post(`/api/v1/blocks/${userId}`);
    return res.data.data;
};

export const unblockUser = async (userId) => {
    const res = await client.delete(`/api/v1/blocks/${userId}`);
    return res.data.data;
};

export const listBlocked = async () => {
    const res = await client.get("/api/v1/blocks");
    return res.data.data;
};

export const getBlockStatus = async (userId) => {
    const res = await client.get(`/api/v1/blocks/${userId}/status`);
    return res.data.data;
};
