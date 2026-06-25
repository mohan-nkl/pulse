import client from "./client";

export const signup = async ({ phone, password, name }) => {
    const response = await client.post("/api/auth/signup", { phone, password, name });

    return response.data.data;
};

export const login = async ({ phone, password }) => {
    const response = await client.post("/api/auth/login", { phone, password });
    return response.data.data;
};
