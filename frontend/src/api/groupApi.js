import client from "./client";

export const listGroups = async () => {
    const response = await client.get("/api/groups");
    return response.data.data;
};

export const createGroup = async ({ name, memberIds }) => {
    const response = await client.post("/api/groups", { name, memberIds });
    return response.data.data;
};

export const getGroupMembers = async (groupId) => {
    const response = await client.get(`/api/groups/${groupId}/members`);
    return response.data.data;
};

export const addGroupMembers = async (groupId, memberIds) => {
    const response = await client.post(`/api/groups/${groupId}/members`, { memberIds });
    return response.data.data;
};

export const removeGroupMember = async (groupId, userId) => {
    const response = await client.delete(`/api/groups/${groupId}/members/${userId}`);
    return response.data.data;
};

export const makeGroupAdmin = async (groupId, userId) => {
    const response = await client.post(`/api/groups/${groupId}/admins/${userId}`);
    return response.data.data;
};

export const leaveGroup = async (groupId) => {
    await client.post(`/api/groups/${groupId}/leave`);
};

export const getGroupHistory = async (groupId) => {
    const response = await client.get(`/api/conversations/group/${groupId}`);
    return response.data.data;
};