export default function Brand({ tagline, size = "lg" }) {
    const small = size === "sm";
    return (
        <div style={styles.wrap}>
            <div style={{ ...styles.mark, ...(small ? styles.markSm : {}) }}>
                <svg viewBox="0 0 40 40" width={small ? "22" : "34"} height={small ? "22" : "34"}
                     fill="none" stroke="var(--c-on-accent)" strokeWidth="2.4"
                     strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 20 h6 l3.2 -9 l4.6 18 l3.2 -9 h6.8" />
                </svg>
            </div>
            <div style={{ ...styles.word, ...(small ? styles.wordSm : {}) }}>Pulse</div>
            {tagline && <p style={styles.tagline}>{tagline}</p>}
        </div>
    );
}

const styles = {
    wrap: { display: "flex", flexDirection: "column", alignItems: "center" },
    mark: {
        width: "58px",
        height: "58px",
        borderRadius: "17px",
        background: "linear-gradient(135deg, var(--c-accent), var(--c-accent-hover))",
        display: "grid",
        placeItems: "center",
        boxShadow: "0 10px 28px rgba(74,157,137,0.35)",
    },
    markSm: { width: "40px", height: "40px", borderRadius: "12px", boxShadow: "none" },
    word: {
        marginTop: "14px",
        fontSize: "30px",
        fontWeight: 700,
        letterSpacing: "-0.5px",
        lineHeight: 1,
        background: "linear-gradient(120deg, var(--c-accent), var(--c-accent-hover))",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "var(--c-accent)",
    },
    wordSm: { marginTop: "8px", fontSize: "20px" },
    tagline: { marginTop: "6px", fontSize: "13px", color: "var(--c-muted)", letterSpacing: "0.3px" },
};