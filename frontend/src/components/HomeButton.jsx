import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function HomeButton({ compact = false, style }) {
    const navigate = useNavigate();
    const [hover, setHover] = useState(false);

    return (
        <button
            type="button"
            title="Home"
            onClick={() => navigate("/")}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: compact ? 0 : "6px",
                padding: compact ? "7px" : "7px 12px",
                border: "1px solid #2a3942",
                borderRadius: "8px",
                background: hover ? "#1d2a32" : "transparent",
                color: "#e9edef",
                fontSize: "13px",
                lineHeight: 1,
                cursor: "pointer",
                transition: "background 0.15s ease",
                ...style,
            }}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {!compact && "Home"}
        </button>
    );
}