import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { subscriptionApi } from '../services/api';
import { Lock } from 'lucide-react';

interface SubscriptionCheckProps {
  children: React.ReactNode;
}

export const SubscriptionCheck: React.FC<SubscriptionCheckProps> = ({ children }) => {
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isSubscriptionValid, setIsSubscriptionValid] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');

  // Define paths that should bypass subscription check
  const EXEMPT_PATHS = [
    '/subscription',
    '/nosidebar/subscription',
    '/login',
    '/register',
    '/settings',
    '/myaccount',
    '/nosidebar/myaccount',
    '/nosidebar/account/add-ons',
    '/reset-password',
    '/forgot-password',
    '/verify-email',
    '/zoho/cancel-pending',
  ];

  useEffect(() => {
    const verifySubscription = async () => {
      // Skip the subscription check for exempt paths
      if (EXEMPT_PATHS.some(path => location.pathname.startsWith(path))) {
        setIsChecking(false);
        return;
      }

      if (!user?.user_id) {
        setIsChecking(false);
        return;
      }

      try {
        // Get latest subscription status directly using the API
        const status = await subscriptionApi.getSubscriptionStatus(user.user_id);
        
        // Check if subscription is valid (active and not cancelled/expired)
        const isValid = status && (
          status.status === 'active' || 
          status.status === 'trialing'
        );
        
        setIsSubscriptionValid(isValid);
        setSubscriptionStatus(status?.status || 'none');
        
        // Always refresh user data after checking subscription
        // to ensure user has latest subscription info in token
        await refreshUserData();
      } catch (error) {
        console.error('Error verifying subscription:', error);
        // Show error state but allow content to render
        setIsSubscriptionValid(true);
      } finally {
        setIsChecking(false);
      }
    };

    if (user) {
      verifySubscription();
    } else {
      setIsChecking(false);
    }
  }, [user, location.pathname, refreshUserData]);

  const handleRenewClick = () => {
    // Create state object with string values only
    const state = {
      currentPlanId: user?.subscription_plan_id?.toString() || '',
      fromExpired: 'true',
      isExpired: 'true',
      returnTo: location.pathname
    };

    // Navigate to subscription page
    navigate('/nosidebar/subscription', { state });
  };

  // If still checking, show loading
  if (isChecking) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // If subscription is valid or on an exempt path, render the children normally
  if (isSubscriptionValid || EXEMPT_PATHS.some(path => location.pathname.startsWith(path))) {
    return <>{children}</>;
  }

  // If subscription is invalid, render the children (including header) with the subscription modal overlay
  const isCancelled = subscriptionStatus === 'cancelled';
  
  return (
    <>
      {children}
      <div className="fixed inset-0 top-[64px] z-40 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full text-center">
          <Lock className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isCancelled ? 'Subscription Cancelled' : 'Subscription Expired'}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {isCancelled 
              ? 'Your subscription has been cancelled. Please subscribe again to continue using our services.' 
              : 'Your subscription has expired. Please renew to continue using our services.'}
          </p>
          <button
            onClick={handleRenewClick}
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {isCancelled ? 'Subscribe Now' : 'Renew Subscription'}
          </button>
        </div>
      </div>
    </>
  );
}; 