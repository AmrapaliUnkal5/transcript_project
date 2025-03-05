import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { BotProvider } from "./context/BotContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Welcome } from "./pages/Welcome";
import { CreateBot } from "./pages/CreateBot";
import { ChatbotCustomization } from "./pages/ChatbotCustomization";
import { FileUpload } from "./pages/FileUpload";
import { Performance } from "./pages/Performance";
import { Subscription } from "./pages/Subscription";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Auth/Login";
import { SignUp } from "./pages/Auth/SignUp";
import { ForgotPassword } from "./pages/Auth/ForgotPassword";
import LoginHome from "./pages/LoginHome";
import { ResetPassword } from "./pages/Auth/ResetPassword";
import PlanSelection from "./pages/Options";
import { LoaderProvider } from "./context/LoaderContext"; // Import LoaderProvider
import Loader from "./components/Loader"; // Import Loader component

function App() {
  return (
    <BrowserRouter>
      <LoaderProvider>
        <AuthProvider>
          <BotProvider>
            <Loader />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/home" element={<LoginHome />} />
              <Route path="/options" element={<PlanSelection />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Welcome />} />
                <Route path="create-bot" element={<CreateBot />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="chatbot" element={<ChatbotCustomization />} />
                <Route path="upload" element={<FileUpload />} />
                <Route path="performance" element={<Performance />} />
                <Route path="subscription" element={<Subscription />} />
                <Route path="myaccount" element={<Settings />} />
              </Route>
            </Routes>
          </BotProvider>
        </AuthProvider>
      </LoaderProvider>
    </BrowserRouter>
  );
}

export default App;
