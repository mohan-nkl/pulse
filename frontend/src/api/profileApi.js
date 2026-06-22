import client from "./client";

export const getMyProfile = async () => {
    const response = await client.get("/api/v1/profile");
    return response.data.data;
};

export const updateProfile = async ({ name, about }) => {
    const response = await client.put("/api/v1/profile", { name, about });
    return response.data.data;
};

export const uploadAvatar = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await client.post("/api/v1/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.data;
};

export const getUserProfile = async (userId) => {
    const response = await client.get(`/api/v1/users/${userId}/profile`);
    return response.data.data;
};