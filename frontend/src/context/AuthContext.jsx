import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { signup as signupApi, login as loginApi } from "../api/authApi.js";
import client, { saveToken, clearToken } from "../api/client.js";

const USER_KEY = "pulse_user";

const INACTIVITY_LIMIT_MS = 60 * 60 * 1000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {

    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem(USER_KEY);
        return saved ? JSON.parse(saved) : null;
    });

    const inactivityTimerRef = useRef(null);

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

        const resetTimer = () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = setTimeout(() => {
                clearSession("expired");
            }, INACTIVITY_LIMIT_MS);
        };

        const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove", "click"];
        events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));

        resetTimer();

        return () => {
            events.forEach((evt) => window.removeEventListener(evt, resetTimer));
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
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
