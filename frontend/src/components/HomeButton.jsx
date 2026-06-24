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
                gap: compact ? 0 : "7px",
                padding: compact ? "8px" : "8px 14px",
                border: "none",
                borderRadius: "9px",
                background: hover ? "#06cf7f" : "#00a884",
                color: "#0b141a",
                fontSize: "13.5px",
                fontWeight: 600,
                lineHeight: 1,
                cursor: "pointer",
                transition: "background 0.15s ease",
                ...style,
            }}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            {!compact && "Home"}
        </button>
    );
}