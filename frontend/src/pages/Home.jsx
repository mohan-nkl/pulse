import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    const firstName = (user?.name || "").trim().split(" ")[0];

    return (
        <div className="pulse-home">
            <style>{css}</style>

            <div className="pulse-card">
                <div className="pulse-logo-wrap">
                    <span className="pulse-ring" />
                    <span className="pulse-ring pulse-ring-2" />
                    <div className="pulse-logo">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="1.8"
                             strokeLinecap="round" strokeLinejoin="round" width="30" height="30">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                    </div>
                </div>

                <h1 className="pulse-greeting">
                    Welcome back{firstName ? `, ${firstName}` : ""}
                </h1>
                {user?.phone && <p className="pulse-sub">{user.phone}</p>}

                <div className="pulse-rows">
                    <button className="pulse-row" onClick={() => navigate("/chat")}>
                        <span className="pulse-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                 strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                        </span>
                        <span className="pulse-row-text">
                            <span className="pulse-row-title">Open chat</span>
                            <span className="pulse-row-desc">Jump back into your conversations</span>
                        </span>
                        <Chevron />
                    </button>

                    <button className="pulse-row" onClick={() => navigate("/contacts")}>
                        <span className="pulse-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                 strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </span>
                        <span className="pulse-row-text">
                            <span className="pulse-row-title">Contacts</span>
                            <span className="pulse-row-desc">Find and manage people you've added</span>
                        </span>
                        <Chevron />
                    </button>

                    <button className="pulse-row" onClick={() => navigate("/profile")}>
                        <span className="pulse-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                                 strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </span>
                        <span className="pulse-row-text">
                            <span className="pulse-row-title">Profile</span>
                            <span className="pulse-row-desc">Your name, photo and about</span>
                        </span>
                        <Chevron />
                    </button>
                </div>

                <button className="pulse-logout" onClick={handleLogout}>
                    Log out
                </button>
            </div>

            <p className="pulse-foot">
                <span className="pulse-foot-dot" /> Pulse
            </p>
        </div>
    );
}

function Chevron() {
    return (
        <svg className="pulse-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <polyline points="9 18 15 12 9 6" />
        </svg>
    );
}

const css = `
.pulse-home {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 24px;
    box-sizing: border-box;
    background:
        radial-gradient(1200px 500px at 50% -10%, rgba(0,168,132,0.10), transparent 60%),
        #0b141a;
    color: #e9edef;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.pulse-card {
    width: 100%;
    max-width: 400px;
    background: #111b21;
    border: 1px solid #1f2c33;
    border-radius: 18px;
    padding: 36px 24px 24px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.45);
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: pulseRise 0.5s ease both;
}

.pulse-logo-wrap {
    position: relative;
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    margin-bottom: 18px;
}

.pulse-logo {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #00a884, #25d366);
    box-shadow: 0 8px 24px rgba(0,168,132,0.45);
    position: relative;
    z-index: 2;
}

.pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(37,211,102,0.55);
    animation: pulseRing 2.4s ease-out infinite;
    z-index: 1;
}
.pulse-ring-2 { animation-delay: 1.2s; }

.pulse-greeting {
    margin: 0;
    font-size: 23px;
    font-weight: 600;
    letter-spacing: -0.2px;
    text-align: center;
}

.pulse-sub {
    margin: 4px 0 0;
    font-size: 13px;
    color: #8696a0;
    letter-spacing: 0.3px;
}

.pulse-rows {
    width: 100%;
    margin-top: 26px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pulse-row {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    border: 1px solid #1f2c33;
    border-radius: 12px;
    background: #16222a;
    color: #e9edef;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}
.pulse-row:hover {
    background: #1d2a32;
    border-color: #2a3942;
    transform: translateX(2px);
}
.pulse-row:focus-visible {
    outline: 2px solid #25d366;
    outline-offset: 2px;
}

.pulse-icon {
    flex: 0 0 auto;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: rgba(0,168,132,0.14);
    color: #38d39f;
}

.pulse-row-text { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.pulse-row-title { font-size: 15px; font-weight: 600; }
.pulse-row-desc { font-size: 12.5px; color: #8696a0; margin-top: 2px; }

.pulse-chevron { color: #5b6b74; flex: 0 0 auto; transition: color 0.15s ease; }
.pulse-row:hover .pulse-chevron { color: #8696a0; }

.pulse-logout {
    margin-top: 22px;
    padding: 9px 16px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #8696a0;
    font-size: 14px;
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
}
.pulse-logout:hover { color: #f15c6d; background: rgba(241,92,109,0.10); }

.pulse-foot {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0;
    font-size: 13px;
    color: #5b6b74;
    letter-spacing: 1px;
    text-transform: uppercase;
}
.pulse-foot-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #25d366;
    box-shadow: 0 0 8px rgba(37,211,102,0.8);
}

@keyframes pulseRing {
    0%   { transform: scale(0.85); opacity: 0.55; }
    100% { transform: scale(2.1);  opacity: 0; }
}
@keyframes pulseRise {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
    .pulse-ring { animation: none; opacity: 0; }
    .pulse-card { animation: none; }
}
`;