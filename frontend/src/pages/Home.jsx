import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {

    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>Welcome to Pulse, {user?.name}</h1>
            <p style={styles.subtitle}>You are logged in as {user?.phone}.</p>

            <button style={styles.profileBtn} onClick={() => navigate("/profile")}>
                View Profile
            </button>

            <button style={styles.chatBtn} onClick={() => navigate("/chat")}>
                Open Chat
            </button>

            <button style={styles.contactsBtn} onClick={() => navigate("/contacts")}>
                Contacts
            </button>

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
    profileBtn: {
        padding: "10px 20px",
        fontSize: "15px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#fff",
        color: "#111",        // dark label so it's visible on the white button
    },
    chatBtn: {
        padding: "10px 20px",
        fontSize: "15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#25d366",  // WhatsApp-ish green
        color: "#fff",
    },
    contactsBtn: {
        padding: "10px 20px",
        fontSize: "15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        background: "#1a73e8",
        color: "#fff",
    },
    button: {
        padding: "10px 20px",
        fontSize: "15px",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
    },
};