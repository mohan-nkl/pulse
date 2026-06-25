import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import ViewProfile from "./pages/ViewProfile";
import Contacts from "./pages/Contacts";
import ChatPage from "./pages/ChatPage";
import StatusPage from "./pages/StatusPage";

import "./index.css";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <NotificationProvider>
                    <SocketProvider>
                        <Routes>
                            <Route path="/signup" element={<Signup />} />
                            <Route path="/login" element={<Login />} />

                            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
                            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                            <Route path="/users/:userId/profile" element={<ProtectedRoute><ViewProfile /></ProtectedRoute>} />
                            <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
                            <Route path="/status" element={<ProtectedRoute><StatusPage /></ProtectedRoute>} />
                        </Routes>
                    </SocketProvider>
                </NotificationProvider>
            </AuthProvider>
        </BrowserRouter>
    </StrictMode>
);