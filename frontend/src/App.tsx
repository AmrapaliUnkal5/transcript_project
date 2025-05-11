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
import { SubscriptionSuccess } from "./pages/SubscriptionSuccess.tsx";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Auth/Login";
import { SignUp } from "./pages/Auth/SignUp";
import { ForgotPassword } from "./pages/Auth/ForgotPassword";
import LoginHome from "./pages/LoginHome";
import { ResetPassword } from "./pages/Auth/ResetPassword";
import { PlanSelection } from "./pages/Options";
import { LoaderProvider } from "./context/LoaderContext"; // Import LoaderProvider
import Loader from "./components/Loader"; // Import Loader component
import VerifyEmail from "./pages/Auth/VerifyEmail";
import { Demo } from "./pages/Demo.tsx";
import { FAQ } from "./pages/FaqPage.tsx";
import { PrivacyPolicy } from "./pages/Legal/PrivacyPolicy.tsx";
import { TermsOfService } from "./pages/Legal/TermsOfService.tsx";
import { ReportIssue } from "./pages/ReportIssue.tsx";
import { CustomerSupportRequest } from "./pages/CustomerSupport.tsx";
import { SubscriptionPlanProvider } from "./context/SubscriptionPlanContext";
import { ScriptGeneratePage } from "./pages/ScriptGeneratePage";
import { TeamInvitation } from "./pages/TeamInvitation.tsx";
import { AddonPurchasePage } from "./pages/AddonPurchasePage";
import HomePage from "./pages/Home/index.tsx";

function App() {
  return (
    <BrowserRouter>
      <LoaderProvider>
        <AuthProvider>
          <BotProvider>
            <SubscriptionPlanProvider>
              <Loader />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/login-home" element={<LoginHome />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/faq" element={<FAQ />} />
                <Route path="/privacy_policy" element={<PrivacyPolicy />} />
                <Route
                  path="/team/invitation/:invitation_token"
                  element={<TeamInvitation />}
                />
                <Route path="/terms" element={<TermsOfService />} />
                <Route path="report-issue" element={<ReportIssue />} />
                <Route
                  path="customersupport"
                  element={<CustomerSupportRequest />}
                />
                
                {/* Main layout with sidebar */}
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
                  <Route
                    path="/script-generate"
                    element={<ScriptGeneratePage />}
                  />
                  <Route path="subscription" element={<Subscription />} />
                  <Route
                    path="subscription/success"
                    element={<SubscriptionSuccess />}
                  />
                  <Route path="myaccount" element={<Settings />} />
                  <Route path="account/add-ons" element={<AddonPurchasePage />} />
                  <Route path="options" element={<PlanSelection />} />
                  {/* <Route path="report-issue" element={<ReportIssue />} /> */}
                </Route>
              </Routes>
            </SubscriptionPlanProvider>
          </BotProvider>
        </AuthProvider>
      </LoaderProvider>
    </BrowserRouter>
  );
}
export default App;
