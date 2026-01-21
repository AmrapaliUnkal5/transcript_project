import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NoSidebarLayout } from "./components/Layout/NoSidebarLayout";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Auth/Login";
import { SignUp } from "./pages/Auth/SignUp";
import { ForgotPassword } from "./pages/Auth/ForgotPassword";
import LoginHome from "./pages/LoginHome";
import { ResetPassword } from "./pages/Auth/ResetPassword";
import { PlanSelection } from "./pages/Options";
import { LoaderProvider } from "./context/LoaderContext"; 
import Loader from "./components/Loader"; 
import VerifyEmail from "./pages/Auth/VerifyEmail";
import { Demo } from "./pages/Demo.tsx";

import { FAQ } from "./pages/FaqPage.tsx";

import { ReportIssue } from "./pages/ReportIssue.tsx";
import { CustomerSupportRequest } from "./pages/CustomerSupport.tsx";
import { TeamInvitation } from "./pages/TeamInvitation.tsx";
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
import OurServices from "./pages/OurService/Index.tsx";
import About from "./pages/About/index.tsx";
import SuperAdminLogin from "./pages/SuperAdminLogin.tsx"
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import ReactGA from "react-ga4";
import TranscriptWelcome from "./pages/TranscriptWelcome";
import TranscriptNew from "./pages/TranscriptNew";
import TranscriptList from "./pages/TranscriptList";
import TranscriptDetail from "./pages/TranscriptDetail";
import TranscriptUpload from "./pages/TranscriptUpload";
import TranscriptLookup from "./pages/TranscriptLookup";
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID ;
const TrackPageView = () => {
  const location = useLocation();
  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: location.pathname + location.search });
  }, [location]);

  return null;
};


function App() {
   useEffect(() => {
    ReactGA.initialize(GA_MEASUREMENT_ID);
  }, []);
  return (
    <BrowserRouter basename="/voice">
    <TrackPageView />
    <ScrollToTop />
      <LoaderProvider>
        <AuthProvider>
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
                <Route path="/superadmin-login" element={<SuperAdminLogin />} />
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
                  <Route path="transcript_welcome" element={<TranscriptWelcome />} />
                  <Route path="transcript" element={<TranscriptList />} />
                  <Route path="transcript/new" element={<TranscriptNew />} />
                  <Route path="transcript/lookup" element={<TranscriptLookup />} />
                  <Route path="transcript/upload/:id" element={<TranscriptUpload />} />
                  <Route path="transcript/:id" element={<TranscriptDetail />} />
                  <Route path="myaccount" element={<Settings />} />
                  <Route path="options" element={<PlanSelection />} />
                </Route>
              </Routes>
        </AuthProvider>
      </LoaderProvider>
    </BrowserRouter>
  );
}
export default App;
