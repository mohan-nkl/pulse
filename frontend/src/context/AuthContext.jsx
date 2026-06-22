import { createContext, useContext, useState } from "react";
import { signup as signupApi, login as loginApi } from "../api/authApi.js";
import client, { saveToken, clearToken } from "../api/client.js";

const USER_KEY = "pulse_user";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem(USER_KEY);
        return saved ? JSON.parse(saved) : null;
    });

    const handleAuthSuccess = (data) => {
        saveToken(data.token);

        const profile = {
            userId: data.userId,
            phone: data.phone,
            name: data.name,
            avatarUrl: data.avatarUrl,
        };

        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        setUser(profile);
    };

    const signup = async (form) => {
        const data = await signupApi(form);
        handleAuthSuccess(data);
    };

    const login = async (form) => {
        const data = await loginApi(form);
        handleAuthSuccess(data);
    };

    const logout = async () => {
        try {
            await client.post("/api/v1/auth/logout");
        } catch (_) {
            // best-effort — still clear local session even if request fails
        }
        clearToken();
        localStorage.removeItem(USER_KEY);
        setUser(null);
    };

    const updateUser = (changes) => {
        setUser((prev) => {
            const updated = { ...prev, ...changes };
            localStorage.setItem(USER_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    const value = {
        user,
        isAuthenticated: user !== null,
        signup,
        login,
        logout,
        updateUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (context === null) {
        throw new Error("useAuth must be used inside an <AuthProvider>");
    }

    return context;
}