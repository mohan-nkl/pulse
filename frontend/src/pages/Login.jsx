import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {

    const { login } = useAuth();
    const navigate = useNavigate();

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const [notice, setNotice] = useState("");
    useEffect(() => {
        if (sessionStorage.getItem("pulse_logout_reason") === "expired") {
            setNotice("Your session expired due to inactivity. Please log in again.");
            sessionStorage.removeItem("pulse_logout_reason");
        }
    }, []);

    const handleSubmit = async (event) => {

        event.preventDefault();

        setError("");
        setSubmitting(true);

        try {
            await login({ phone, password });

            navigate("/");
        } catch (err) {

            const message =
                err.response?.data?.message || "Something went wrong. Please try again.";
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={styles.container}>
            <form style={styles.form} onSubmit={handleSubmit}>
                <h1 style={styles.title}>Log in to Pulse</h1>

                {notice && <div style={styles.notice}>{notice}</div>}

                {}
                {error && <div style={styles.error}>{error}</div>}

                <label style={styles.label}>Phone</label>
                <input
                    style={styles.input}
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                />

                <label style={styles.label}>Password</label>
                <input
                    style={styles.input}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                />

                <button style={styles.button} type="submit" disabled={submitting}>
                    {submitting ? "Logging in..." : "Log in"}
                </button>

                <p style={styles.switchText}>
                    New here? <Link to="/signup">Create an account</Link>
                </p>
            </form>
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
    },
    form: {
        display: "flex",
        flexDirection: "column",
        width: "320px",
        padding: "24px",
        border: "1px solid #ddd",
        borderRadius: "8px",
    },
    title: { fontSize: "20px", marginBottom: "16px", textAlign: "center" },
    label: { fontSize: "14px", marginBottom: "4px", marginTop: "12px" },
    input: {
        padding: "10px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "6px",
    },
    button: {
        marginTop: "20px",
        padding: "10px",
        fontSize: "15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
    },
    notice: {
        background: "#0b3d2e",
        color: "#7ee2b8",
        border: "1px solid #14543f",
        padding: "10px",
        borderRadius: "6px",
        fontSize: "14px",
        marginBottom: "8px",
    },
    error: {
        background: "#fdecea",
        color: "#b71c1c",
        padding: "10px",
        borderRadius: "6px",
        fontSize: "14px",
        marginBottom: "8px",
    },
    switchText: { fontSize: "13px", textAlign: "center", marginTop: "16px" },
};
