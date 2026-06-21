import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Welcome to Pulse, {user?.name}</h1>
            <p style={styles.subtitle}>You are logged in as {user?.phone}.</p>

            <button style={styles.button} onClick={handleLogout}>
                Log out
            </button>
        </div>
    );
}

const styles = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "12px",
    },
    title: { fontSize: "24px" },
    subtitle: { fontSize: "15px", color: "#555" },
    button: {
        marginTop: "16px",
        padding: "10px 20px",
        fontSize: "15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
    },
};