import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { SocketProvider } from "./context/SocketContext";
import { CallProvider } from "./context/CallContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/AppShell";

import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import ViewProfile from "./pages/ViewProfile";
import Contacts from "./pages/Contacts";
import Blocked from "./pages/Blocked";
import ChatPage from "./pages/ChatPage";
import StatusPage from "./pages/StatusPage";
import CallsPage from "./pages/CallsPage";

import "./index.css";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <AuthProvider>
                    <NotificationProvider>
                        <SocketProvider>
                            <CallProvider>
                                <Routes>
                                    <Route path="/signup" element={<Signup />} />
                                    <Route path="/login" element={<Login />} />

                                    <Route path="/" element={<ProtectedRoute><Navigate to="/chat" replace /></ProtectedRoute>} />
                                    <Route path="/chat" element={<ProtectedRoute><AppShell><ChatPage /></AppShell></ProtectedRoute>} />
                                    <Route path="/calls" element={<ProtectedRoute><AppShell><CallsPage /></AppShell></ProtectedRoute>} />
                                    <Route path="/profile" element={<ProtectedRoute><AppShell><Profile /></AppShell></ProtectedRoute>} />
                                    <Route path="/users/:userId/profile" element={<ProtectedRoute><AppShell><ViewProfile /></AppShell></ProtectedRoute>} />
                                    <Route path="/contacts" element={<ProtectedRoute><AppShell><Contacts /></AppShell></ProtectedRoute>} />
                                    <Route path="/blocked" element={<ProtectedRoute><AppShell><Blocked /></AppShell></ProtectedRoute>} />
                                    <Route path="/status" element={<ProtectedRoute><AppShell><StatusPage /></AppShell></ProtectedRoute>} />
                                </Routes>
                            </CallProvider>
                        </SocketProvider>
                    </NotificationProvider>
                </AuthProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>
);
