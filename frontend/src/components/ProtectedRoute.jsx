import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { isAuthenticated } = useAuth();

    // Back/forward cache (bfcache) can restore a previously-rendered page
    // without re-running React. If the user logged out and then pressed Back,
    // the browser might show the cached authenticated page. The `pageshow`
    // event fires when a page is shown — including from bfcache (event.persisted
    // is true). In that case we force a reload so auth is re-evaluated and the
    // user is redirected to /login if they're no longer authenticated.
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
