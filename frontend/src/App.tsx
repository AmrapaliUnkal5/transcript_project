import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './pages/Dashboard';
import { ChatbotCustomization } from './pages/ChatbotCustomization';
import { FileUpload } from './pages/FileUpload';
import { Performance } from './pages/Performance';
import { Subscription } from './pages/Subscription';
import { Settings } from './pages/Settings';
import { Login } from './pages/Auth/Login';
import { SignUp } from './pages/Auth/SignUp';
import { ForgotPassword } from './pages/Auth/ForgotPassword';
import LoginHome from './pages/LoginHome';
import { ResetPassword } from "./pages/Auth/ResetPassword";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/home" element={<LoginHome />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="chatbot" element={<ChatbotCustomization />} />
            <Route path="upload" element={<FileUpload />} />
            <Route path="performance" element={<Performance />} />
            <Route path="subscription" element={<Subscription />} />
            <Route path="myaccount" element={<Settings />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
