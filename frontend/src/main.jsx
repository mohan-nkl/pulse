import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import ViewProfile from "./pages/ViewProfile";
import Contacts from "./pages/Contacts";

import "./index.css";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        {/* BrowserRouter turns URLs into page navigation. */}
        <BrowserRouter>
            {/* AuthProvider makes the logged-in user available everywhere via useAuth(). */}
            <AuthProvider>
                <Routes>
                    {/* Public pages — reachable without logging in. */}
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/login" element={<Login />} />

                    {/* Protected page — ProtectedRoute sends guests to /login. */}
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <Home />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <Profile />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/users/:userId/profile"
                        element={
                            <ProtectedRoute>
                                <ViewProfile />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/contacts"
                        element={
                            <ProtectedRoute>
                                <Contacts />
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>
);