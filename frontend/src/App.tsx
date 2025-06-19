import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { BotProvider } from "./context/BotContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout/Layout";
import { NoSidebarLayout } from "./components/Layout/NoSidebarLayout";
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

import { ReportIssue } from "./pages/ReportIssue.tsx";
import { CustomerSupportRequest } from "./pages/CustomerSupport.tsx";
import { SubscriptionPlanProvider } from "./context/SubscriptionPlanContext";
import { ScriptGeneratePage } from "./pages/ScriptGeneratePage";
import { TeamInvitation } from "./pages/TeamInvitation.tsx";
import { AddonPurchasePage } from "./pages/AddonPurchasePage";
import HomePage from "./pages/Home/index.tsx";
import OurPlans from "./pages/OurPlans/index.tsx";
import FAQPage from "./pages/FAQ/index.tsx";
import ContactUs from "./pages/ContactUs/index.tsx";
import DataDeletion from "./pages/DataDeletion/index.tsx";
import CancellationRefundPolicy from "./pages/CancellationAndRefund/index.tsx";
import TermsService from "./pages/TermsOfService/index.tsx";
import Privacy from "./pages/Privacy/index.tsx";
import ScrollToTop from "./components/ScrolltoTop.tsx";
import ShippingAndExchange from "./pages/ShippingAndExchange/index.tsx";
import Investigation from "./pages/investigation.tsx";
import OurServices from "./pages/OurService/Index.tsx";
import About from "./pages/About/index.tsx";




function App() {
  return (
    <BrowserRouter>
    <ScrollToTop />
      <LoaderProvider>
        <AuthProvider>
          <BotProvider>
            <SubscriptionPlanProvider>
              <Loader />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/" element={<HomePage />} />
                <Route path="/our-plans" element={<OurPlans />} />
                <Route path="/login-home" element={<LoginHome />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/faq" element={<FAQ />} />
          
                <Route
                  path="/team/invitation/:invitation_token"
                  element={<TeamInvitation />}
                />
              
                <Route path="report-issue" element={<ReportIssue />} />
                <Route
                  path="customersupport"
                  element={<CustomerSupportRequest />}
                />


                <Route path="/contact-us" element={<ContactUs />} />             

                <Route path="/faq-page" element={<FAQPage />} />
                <Route path="/terms-of-service" element={<TermsService />} />
                <Route path="/privacy-policy" element={<Privacy />} />
           

 

                <Route path="/data-deletion" element={<DataDeletion />} />
                <Route path="/cancellation-refund-policy" element={<CancellationRefundPolicy />} />
                <Route path="/shipping-exchange-policy" element={<ShippingAndExchange />} />
                <Route path="/our-services" element={<OurServices />} />
                <Route path="/about-us" element={<About />} />
                


                
                {/* NoSidebar layout for specific pages */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <NoSidebarLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="welcome" element={<Welcome />} />
                  <Route path="subscription" element={<Subscription />} />
                  <Route path="subscription/success" element={<SubscriptionSuccess />} />
                  <Route path="myaccount" element={<Settings />} />
                  <Route path="account/add-ons" element={<AddonPurchasePage />} />
                  <Route path="options" element={<PlanSelection />} />
                  <Route path="create-bot" element={<CreateBot />} />
                </Route>
                
                {/* Main layout with sidebar */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Layout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="chatbot" element={<ChatbotCustomization />} />
                  <Route path="upload" element={<FileUpload />} />
                  <Route path="investigation" element={<Investigation />} />
                  <Route path="performance" element={<Performance />} />
                  <Route
                    path="script-generate"
                    element={<ScriptGeneratePage />}
                  />
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
