import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
    const { login, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();

    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [notice, setNotice] = useState("");
    const [wasAuthedAtMount] = useState(isAuthenticated);

    useEffect(() => {
        if (wasAuthedAtMount) {
            logout();
        }
    }, [wasAuthedAtMount, logout]);

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
            navigate("/chat");
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout>
            <h2 className="auth-heading">Welcome back</h2>

            {notice && <div className="auth-msg auth-msg-notice">{notice}</div>}
            {error && <div className="auth-msg auth-msg-error">{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
                <label className="auth-label">Phone</label>
                <input
                    className="auth-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                />

                <label className="auth-label">Password</label>
                <input
                    className="auth-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                />

                <button className="auth-btn" type="submit" disabled={submitting}>
                    {submitting ? "Logging in…" : "Log in"}
                </button>
            </form>

            <p className="auth-switch">
                New to Pulse? <Link className="auth-link" to="/signup">Create an account</Link>
            </p>
        </AuthLayout>
    );
}