import client from "./client";

export const listContacts = async () => {
    const res = await client.get("/api/v1/contacts");
    return res.data.data;
};

export const searchContacts = async (q) => {
    const res = await client.get("/api/v1/contacts/search", { params: { q } });
    return res.data.data;
};

export const addContact = async ({ phone, alias }) => {
    const res = await client.post("/api/v1/contacts", { phone, alias: alias || null });
    return res.data.data;
};

export const addContactByUserId = async (userId) => {
    const res = await client.post(`/api/v1/contacts/user/${userId}`);
    return res.data.data;
};

export const removeContact = async (id) => {
    await client.delete(`/api/v1/contacts/${id}`);
};

export const updateAlias = async (id, alias) => {
    const res = await client.patch(`/api/v1/contacts/${id}/alias`, { alias: alias || null });
    return res.data.data;
};

export const syncPhones = async (phones) => {
    const res = await client.post("/api/v1/contacts/sync", { phones });
    return res.data.data;
};
