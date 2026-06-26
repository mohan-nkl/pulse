import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";

export default function Signup() {
    const { signup } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);
        try {
            await signup({ name, phone, password });
            navigate("/chat");
        } catch (err) {
            setError(err.response?.data?.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout>
            <h2 className="auth-heading">Create your account</h2>

            {error && <div className="auth-msg auth-msg-error">{error}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
                <label className="auth-label">Name</label>
                <input
                    className="auth-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                />

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
                    placeholder="At least 6 characters"
                />

                <button className="auth-btn" type="submit" disabled={submitting}>
                    {submitting ? "Creating account…" : "Create account"}
                </button>
            </form>

            <p className="auth-switch">
                Already have an account? <Link className="auth-link" to="/login">Log in</Link>
            </p>
        </AuthLayout>
    );
}