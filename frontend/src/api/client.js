import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

const TOKEN_KEY = "pulse_token";

export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const client = axios.create({
    baseURL: BASE_URL,
    headers: { "Content-Type": "application/json" },
});

client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

client.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const isAuthCall = (error.config?.url || "").includes("/api/auth/");

        if (status === 401 && !isAuthCall) {
            clearToken();
            window.location.href = "/login";
        }
        return Promise.reject(error);
    }
);

export default client;
