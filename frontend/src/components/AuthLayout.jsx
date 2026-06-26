import Brand from "./Brand";

export default function AuthLayout({ children }) {
    return (
        <div className="auth-page">
            <style>{css}</style>
            <div className="auth-card">
                <aside className="auth-brand">
                    <div className="auth-rings">
                        <span className="auth-ring" />
                        <span className="auth-ring" />
                        <span className="auth-ring" />
                        <div className="auth-logo">
                            <svg viewBox="0 0 40 40" width="34" height="34" fill="none" stroke="#ffffff"
                                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 20 h6 l3.2 -9 l4.6 18 l3.2 -9 h6.8" />
                            </svg>
                        </div>
                    </div>
                    <div className="auth-word">Pulse</div>
                    <p className="auth-tag">Messaging, beautifully quiet.</p>
                    <ul className="auth-features">
                        <li>Private by design</li>
                        <li>Calm, focused conversations</li>
                        <li>Yours, always</li>
                    </ul>
                </aside>

                <main className="auth-form-pane">
                    <div className="auth-mobile-brand"><Brand size="sm" /></div>
                    {children}
                </main>
            </div>
        </div>
    );
}

const css = `
.auth-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    background:
        radial-gradient(900px 600px at 82% -12%, rgba(74,157,137,0.12), transparent 60%),
        radial-gradient(720px 540px at 6% 112%, rgba(74,157,137,0.10), transparent 55%),
        var(--c-bg);
}
.auth-card {
    display: flex;
    width: 880px;
    max-width: 100%;
    min-height: 548px;
    background: var(--c-panel);
    border: 1px solid var(--c-border);
    border-radius: 24px;
    overflow: hidden;
    box-shadow: var(--c-shadow);
    animation: authRise 0.5s ease both;
}
.auth-brand {
    flex: 0 0 45%;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 30px;
    color: #ffffff;
    background: linear-gradient(155deg, var(--c-accent), var(--c-accent-hover));
    overflow: hidden;
}
.auth-brand::after {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(420px 420px at 80% 8%, rgba(255,255,255,0.16), transparent 60%);
    pointer-events: none;
}
.auth-rings {
    position: relative;
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
    margin-bottom: 20px;
    z-index: 1;
}
.auth-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.5);
    animation: authPulse 3s ease-out infinite;
}
.auth-ring:nth-child(2) { animation-delay: 1s; }
.auth-ring:nth-child(3) { animation-delay: 2s; }
.auth-logo {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(255,255,255,0.18);
    border: 1px solid rgba(255,255,255,0.35);
    display: grid;
    place-items: center;
    z-index: 2;
}
.auth-word { font-size: 34px; font-weight: 700; letter-spacing: -0.6px; z-index: 1; }
.auth-tag { font-size: 14px; margin-top: 4px; opacity: 0.92; z-index: 1; }
.auth-features { list-style: none; padding: 0; margin: 26px 0 0; display: flex; flex-direction: column; gap: 11px; z-index: 1; }
.auth-features li { font-size: 13px; opacity: 0.94; display: flex; align-items: center; gap: 9px; }
.auth-features li::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.9); }

.auth-form-pane {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 44px 42px;
    box-sizing: border-box;
}
.auth-mobile-brand { display: none; margin-bottom: 22px; }

.auth-heading { font-size: 21px; font-weight: 600; color: var(--c-text); margin: 0 0 18px; }
.auth-form { display: flex; flex-direction: column; }
.auth-label { font-size: 12.5px; font-weight: 500; color: var(--c-muted); margin: 12px 0 5px; letter-spacing: 0.2px; }
.auth-input {
    padding: 11px 13px;
    font-size: 14px;
    background: var(--c-surface);
    border: 1px solid var(--c-border2);
    border-radius: 10px;
    color: var(--c-text);
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.auth-input::placeholder { color: var(--c-muted2); }
.auth-input:focus { border-color: var(--c-accent); box-shadow: 0 0 0 3px rgba(74,157,137,0.18); }
.auth-btn {
    margin-top: 24px;
    padding: 12px;
    font-size: 15px;
    font-weight: 600;
    border: none;
    border-radius: 10px;
    cursor: pointer;
    background: var(--c-accent);
    color: var(--c-on-accent);
    transition: background 0.15s ease;
}
.auth-btn:hover:not(:disabled) { background: var(--c-accent-hover); }
.auth-btn:disabled { opacity: 0.65; cursor: default; }
.auth-switch { font-size: 13px; color: var(--c-muted); margin-top: 20px; text-align: center; }
.auth-link { color: var(--c-accent); text-decoration: none; font-weight: 600; }
.auth-link:hover { text-decoration: underline; }
.auth-msg { font-size: 13px; padding: 10px 12px; border-radius: 10px; margin-bottom: 6px; }
.auth-msg-notice { background: rgba(74,157,137,0.12); color: var(--c-accent); border: 1px solid rgba(74,157,137,0.30); }
.auth-msg-error { background: rgba(224,113,127,0.12); color: #e0717f; }

@keyframes authPulse { 0% { transform: scale(0.62); opacity: 0.75; } 100% { transform: scale(2); opacity: 0; } }
@keyframes authRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

@media (max-width: 760px) {
    .auth-brand { display: none; }
    .auth-form-pane { padding: 34px 26px; }
    .auth-mobile-brand { display: flex; justify-content: center; }
}
@media (prefers-reduced-motion: reduce) {
    .auth-ring { animation: none; opacity: 0; }
    .auth-card { animation: none; }
}
`;