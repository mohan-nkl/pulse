import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useNotification } from "../context/NotificationContext";
import { getContactStatuses } from "../api/statusApi";

const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
};

function ChatsIcon() {
    return <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>;
}
function StatusIcon() {
    return <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><circle cx="12" cy="12" r="9" strokeDasharray="4 3" /><circle cx="12" cy="12" r="3" /></svg>;
}
function ContactsIcon() {
    return <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function BlockedIcon() {
    return <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><circle cx="12" cy="12" r="9" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" /></svg>;
}
function ProfileIcon() {
    return <svg viewBox="0 0 24 24" width="22" height="22" {...stroke}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function SunIcon() {
    return <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
}
function MoonIcon() {
    return <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
}
function LogoutIcon() {
    return <svg viewBox="0 0 24 24" width="20" height="20" {...stroke}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
}

export default function AppShell({ children }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const { chatHasNew, ackChats } = useNotification();
    const [unseenStatusIds, setUnseenStatusIds] = useState([]);

    useEffect(() => {
        let alive = true;
        const check = () => {
            getContactStatuses()
                .then((list) => {
                    if (alive) setUnseenStatusIds((list || []).filter((s) => !s.viewedByMe).map((s) => s.id));
                })
                .catch(() => {});
        };
        check();
        const timer = setInterval(check, 60000);
        return () => { alive = false; clearInterval(timer); };
    }, []);

    // Visiting a page acknowledges everything pending there, so the dot stays
    // cleared until something genuinely new arrives — even if items are unopened.
    useEffect(() => {
        if (pathname === "/chat") ackChats();
    }, [pathname, chatHasNew, ackChats]);

    useEffect(() => {
        if (pathname === "/status") {
            sessionStorage.setItem("pulse_status_ack", JSON.stringify(unseenStatusIds));
        }
    }, [pathname, unseenStatusIds]);

    const dotFor = (to) => {
        if (to === "/chat") return chatHasNew && pathname !== "/chat";
        if (to === "/status") {
            let ack = [];
            try { ack = JSON.parse(sessionStorage.getItem("pulse_status_ack") || "[]"); } catch { ack = []; }
            const ackSet = new Set(ack);
            return pathname !== "/status" && unseenStatusIds.some((id) => !ackSet.has(id));
        }
        return false;
    };

    const items = [
        { to: "/chat", label: "Chats", icon: <ChatsIcon /> },
        { to: "/status", label: "Status", icon: <StatusIcon /> },
        { to: "/contacts", label: "Contacts", icon: <ContactsIcon /> },
        { to: "/blocked", label: "Blocked", icon: <BlockedIcon /> },
        { to: "/profile", label: "Profile", icon: <ProfileIcon /> },
    ];

    const isActive = (to) => pathname === to || (to === "/profile" && pathname.startsWith("/users/"));

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div style={styles.shell}>
            <style>{css}</style>
            <nav style={styles.rail}>
                <div style={styles.brand} title="Pulse">
                    <svg viewBox="0 0 40 40" width="24" height="24" fill="none" stroke="var(--c-on-accent)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 20 h6 l3.2 -9 l4.6 18 l3.2 -9 h6.8" />
                    </svg>
                </div>

                <div style={styles.navItems}>
                    {items.map((it) => (
                        <button
                            key={it.to}
                            className="pulse-rail-btn"
                            style={{ ...styles.railBtn, ...(isActive(it.to) ? styles.railBtnActive : {}) }}
                            onClick={() => navigate(it.to)}
                            aria-label={it.label}
                        >
                            {it.icon}
                            {dotFor(it.to) && <span style={styles.railDot} />}
                            <span className="pulse-rail-tip">{it.label}</span>
                        </button>
                    ))}
                </div>

                <div style={styles.railBottom}>
                    <button className="pulse-rail-btn" style={styles.railBtn} onClick={toggleTheme} aria-label="Toggle theme">
                        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                        <span className="pulse-rail-tip">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
                    </button>
                    <button className="pulse-rail-btn" style={styles.railBtn} onClick={handleLogout} aria-label="Log out">
                        <LogoutIcon />
                        <span className="pulse-rail-tip">Log out</span>
                    </button>
                </div>
            </nav>

            <div style={styles.content}>{children}</div>
        </div>
    );
}

const styles = {
    shell: { display: "flex", height: "100vh", width: "100%", overflow: "hidden" },
    rail: {
        flex: "0 0 68px",
        width: "68px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "14px 0",
        gap: "6px",
        background: "var(--c-panel)",
        borderRight: "1px solid var(--c-border)",
        boxSizing: "border-box",
    },
    brand: {
        width: "40px",
        height: "40px",
        borderRadius: "12px",
        display: "grid",
        placeItems: "center",
        background: "var(--c-accent)",
        marginBottom: "12px",
        flex: "0 0 auto",
    },
    navItems: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flex: 1 },
    railBottom: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
    railBtn: {
        width: "44px",
        height: "44px",
        borderRadius: "12px",
        display: "grid",
        placeItems: "center",
        border: "none",
        background: "transparent",
        color: "var(--c-muted)",
        cursor: "pointer",
        transition: "background 0.15s ease, color 0.15s ease",
    },
    railBtnActive: { background: "var(--c-surface)", color: "var(--c-accent)" },
    railDot: {
        position: "absolute",
        top: "6px",
        right: "7px",
        width: "13px",
        height: "13px",
        borderRadius: "50%",
        background: "var(--c-accent)",
        border: "2.5px solid var(--c-panel)",
    },
    content: { flex: 1, minWidth: 0, height: "100vh", overflow: "auto" },
};

const css = `
.pulse-rail-btn { position: relative; }
.pulse-rail-btn:hover { background: var(--c-surface) !important; color: var(--c-text) !important; }
.pulse-rail-tip {
    position: absolute;
    left: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%) translateX(-4px);
    white-space: nowrap;
    background: var(--c-text);
    color: var(--c-bg);
    padding: 5px 10px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 500;
    box-shadow: var(--c-shadow-soft);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.14s ease, transform 0.14s ease;
    z-index: 60;
}
.pulse-rail-btn:hover .pulse-rail-tip {
    opacity: 1;
    visibility: visible;
    transform: translateY(-50%) translateX(0);
}
`;