import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        const onPageShow = (event) => {
            if (event.persisted) {
                window.location.reload();
            }
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return children;
}
