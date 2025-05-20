import React, { useEffect, useState } from 'react';
import { AddonPurchaseCard } from '../components/AddonPurchaseCard';
import { useSubscriptionPlans } from '../context/SubscriptionPlanContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscriptionApi } from '../services/api';

export const AddonPurchasePage: React.FC = () => {
  const { addons, isLoading, loadPlans } = useSubscriptionPlans();
  const { user, isAuthenticated } = useAuth();
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [isLoadingPlan, setIsLoadingPlan] = useState(true);
  const navigate = useNavigate();
  
  // Load data if needed
  useEffect(() => {
    loadPlans();
    
    // Load user's current subscription plan details
    if (user?.user_id) {
      setIsLoadingPlan(true);
      subscriptionApi.getCurrentPlan(user.user_id)
        .then(plan => {
          setCurrentPlan(plan);
        })
        .catch(err => {
          console.error("Error loading current plan:", err);
        })
        .finally(() => {
          setIsLoadingPlan(false);
        });
    }
  }, [user?.user_id]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);
  
  // Check if the user has a free plan or no plan
  const hasFreePlan = !isLoadingPlan && (
    !currentPlan || 
    !currentPlan.plan || 
    currentPlan.plan.price === 0 || 
    currentPlan.plan.name.toLowerCase().includes('free')
  );
  
  // Check if the user has a paid plan but no Zoho subscription ID
  const hasInvalidSubscription = !isLoadingPlan && 
    currentPlan && 
    currentPlan.plan && 
    currentPlan.plan.price > 0 && 
    !currentPlan.zoho_subscription_id;
  
  // Filter add-ons by type
  const cycleBoundAddons = addons.filter(addon => addon.addon_type !== "Additional Messages");
  const permanentAddons = addons.filter(addon => addon.addon_type === "Additional Messages");
  
  if (isLoading || isLoadingPlan) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="mt-3 text-gray-600 dark:text-gray-400">Loading available add-ons...</span>
          </div>
        </div>
      </div>
    );
  }
  
  if (!user?.subscription_plan_id || hasFreePlan) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6 mb-8 max-w-3xl mx-auto">
          <h2 className="text-xl font-medium text-yellow-800 dark:text-yellow-200">Paid Subscription Required</h2>
          <p className="text-yellow-700 dark:text-yellow-300 mt-2">
            You need an active paid subscription to purchase add-ons. Free plans are not eligible for add-on purchases.
          </p>
          <button
            onClick={() => navigate('/nosidebar/subscription')}
            className="mt-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
          >
            View Subscription Plans
          </button>
        </div>
      </div>
    );
  }
  
  if (hasInvalidSubscription) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6 mb-8 max-w-3xl mx-auto">
          <h2 className="text-xl font-medium text-orange-800 dark:text-orange-200">Subscription Issue Detected</h2>
          <p className="text-orange-700 dark:text-orange-300 mt-2">
            Your subscription doesn't have a valid billing reference. This may happen if you were manually assigned a plan.
            To purchase add-ons, you need a subscription with a valid billing reference.
          </p>
          <p className="text-orange-700 dark:text-orange-300 mt-2">
            Please contact support for assistance or subscribe to a plan through our subscription page.
          </p>
          <div className="mt-4 flex space-x-4">
            <button
              onClick={() => navigate('/nosidebar/subscription')}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md transition-colors"
            >
              View Subscription Plans
            </button>
            <button
              onClick={() => navigate('/report-issue')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto max-w-7xl px-4 py-10">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Add-ons & Extensions
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            Enhance your subscription with these optional add-ons. Add-ons are billed immediately upon purchase.
          </p>
        </div>
        
        {permanentAddons.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              Usage Add-ons
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              These add-ons provide permanent increases to your usage limits until the quota is exhausted.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {permanentAddons.map(addon => (
                <AddonPurchaseCard key={addon.id} addonId={addon.id} />
              ))}
            </div>
          </div>
        )}
        
        {cycleBoundAddons.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              Feature Add-ons
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              These add-ons follow your subscription billing cycle and will expire at the end of your current billing period.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cycleBoundAddons.map(addon => (
                <AddonPurchaseCard key={addon.id} addonId={addon.id} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 