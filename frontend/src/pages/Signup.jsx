import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Signup() {

    const { signup } = useAuth();
    const navigate = useNavigate();

    // One piece of state per input field.
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");

    // An error message to show the user, and a flag to disable the button while submitting.
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        // Stop the browser's default "reload the page" behaviour on submit.
        event.preventDefault();

        setError("");
        setSubmitting(true);

        try {
            await signup({ name, phone, password });
            // Signup succeeded and we're now logged in — go to the home page.
            navigate("/");
        } catch (err) {
            // Our backend puts the reason inside ApiResponse.message.
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
                <h1 style={styles.title}>Create your Pulse account</h1>

                {/* The error banner only appears when there is an error. */}
                {error && <div style={styles.error}>{error}</div>}

                <label style={styles.label}>Name</label>
                <input
                    style={styles.input}
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                />

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
                    placeholder="At least 6 characters"
                />

                <button style={styles.button} type="submit" disabled={submitting}>
                    {submitting ? "Creating account..." : "Sign up"}
                </button>

                <p style={styles.switchText}>
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </form>
        </div>
    );
}

// Simple inline styles, kept in this file so the whole page is self-contained.
// We can move these to a CSS file later if it grows.
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