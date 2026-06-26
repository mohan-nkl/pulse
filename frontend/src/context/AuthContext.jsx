import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { signup as signupApi, login as loginApi } from "../api/authApi.js";
import client, { saveToken, clearToken } from "../api/client.js";

const USER_KEY = "pulse_user";
const CLOSED_AT_KEY = "pulse_closed_at";

const HIDDEN_LIMIT_MS = 60 * 60 * 1000;
const CLOSED_LIMIT_MS = 10 * 60 * 1000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem(USER_KEY);
        if (!saved) {
            return null;
        }

        const closedAtRaw = localStorage.getItem(CLOSED_AT_KEY);
        localStorage.removeItem(CLOSED_AT_KEY);

        if (closedAtRaw) {
            const closedForMs = Date.now() - Number(closedAtRaw);
            if (closedForMs > CLOSED_LIMIT_MS) {
                clearToken();
                localStorage.removeItem(USER_KEY);
                sessionStorage.setItem("pulse_logout_reason", "expired");
                return null;
            }
        }

        return JSON.parse(saved);
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
        localStorage.removeItem(CLOSED_AT_KEY);
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

    const clearSession = useCallback((reason) => {
        clearToken();
        localStorage.removeItem(USER_KEY);
        if (reason) {
            sessionStorage.setItem("pulse_logout_reason", reason);
        }
        setUser(null);
    }, []);

    const logout = async () => {
        try {
            await client.post("/api/v1/auth/logout");
        } catch (_) {

        }
        clearSession();
    };

    const updateUser = (changes) => {
        setUser((prev) => {
            const updated = { ...prev, ...changes };
            localStorage.setItem(USER_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    useEffect(() => {
        if (!user) return;

        let hiddenAt = 0;

        const onVisibilityChange = () => {
            const tabHidden = (document.visibilityState === "hidden");

            if (tabHidden) {
                hiddenAt = Date.now();
                localStorage.setItem(CLOSED_AT_KEY, String(Date.now()));
                return;
            }

            localStorage.removeItem(CLOSED_AT_KEY);

            const hiddenForMs = hiddenAt ? (Date.now() - hiddenAt) : 0;
            hiddenAt = 0;
            if (hiddenForMs > HIDDEN_LIMIT_MS) {
                clearSession("expired");
            }
        };

        const onPageHide = () => {
            localStorage.setItem(CLOSED_AT_KEY, String(Date.now()));
        };

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", onPageHide);

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pagehide", onPageHide);
        };
    }, [user, clearSession]);

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
