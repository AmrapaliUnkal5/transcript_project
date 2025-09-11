import React, { useState, useEffect } from 'react';
import { useSubscriptionPlans } from '../context/SubscriptionPlanContext';
import { useAuth } from '../context/AuthContext';
import { subscriptionApi } from '../services/api';
import { PlusCircle, MinusCircle, Info, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface AddonPurchaseCardProps {
  addonId: number;
  className?: string;
}

export const AddonPurchaseCard: React.FC<AddonPurchaseCardProps> = ({ addonId, className = '' }) => {
  const { getAddonById, purchaseAddon } = useSubscriptionPlans();
  const { user } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requiresSubscription, setRequiresSubscription] = useState(false);
  const [hasPendingPurchase, setHasPendingPurchase] = useState(false);
  
  // Get the addon details - use the existing getAddonById method
  const addon = getAddonById(addonId);
  
  useEffect(() => {
    // Check for pending purchases
    const checkPendingPurchases = async () => {
      if (user?.user_id) {
        try {
          // Get pending addon purchases for this user
          const response = await subscriptionApi.getUserAddons(user.user_id);
          // Check if any of the pending addons match this addon ID
          if (response && response.pendingAddons) {
            const pendingAddons = response.pendingAddons;
            setHasPendingPurchase(pendingAddons.some((pa: any) => pa.addon_id === addonId));
          }
        } catch (err) {
          console.error("Error checking pending addon purchases:", err);
        }
      }
    };
    
    checkPendingPurchases();
  }, [addonId, user?.user_id]);
  
  if (!addon) {
    return null; // Don't render if addon not found
  }
  
  const handlePurchase = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      // First check if user has a valid subscription
      const checkoutUrl = await purchaseAddon(addonId, quantity);
      
      // Redirect to checkout
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("Failed to generate checkout URL");
      }
    } catch (error: any) {
      // Handle the specific case of no valid subscription
      if (error.message?.includes('active subscription') || 
          error.message?.includes('subscription plan')) {
        setRequiresSubscription(true);
      } else {
        setError(error.message || "An error occurred during checkout");
      }
      setProcessing(false);
    }
  };
  
  const handleContinuePurchase = async () => {
    try {
      setProcessing(true);
      setError(null);
      
      // Reuse the same purchase addon method but indicate it's a continuation
      const checkoutUrl = await purchaseAddon(addonId, quantity, true);
      
      // Redirect to Zoho checkout
      window.location.href = checkoutUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to resume checkout');
      setProcessing(false);
    }
  };
  
  const handleCancelPurchase = async () => {
    try {
      // Use the cancelPendingAddonPurchase method
      await subscriptionApi.cancelPendingAddonPurchase(addonId);
      setHasPendingPurchase(false);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel purchase');
    }
  };
  
  // Determine if this addon is already owned
  const isOwned = user?.addon_plan_ids?.includes(addonId);
  
  // Render pending purchase notification
  const renderPendingPurchaseNotification = () => {
    if (!hasPendingPurchase) return null;
    
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Incomplete Purchase
            </h3>
            <div className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
              <p>You have a pending purchase for this add-on.</p>
              <div className="mt-2 flex space-x-2">
                <button
                  onClick={handleContinuePurchase}
                  className="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded"
                >
                  Continue
                </button>
                <button
                  onClick={handleCancelPurchase}
                  className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}>
      <div className="p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{addon.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{addon.description}</p>
          
          {/* Pending purchase notification */}
          {renderPendingPurchaseNotification()}
          
          <div className="flex items-center justify-between mb-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              ${addon.price.toFixed(2)}
              {addon.name !== 'White-Labeling' && addon.name !== 'Multilingual Support' && quantity > 1 && (
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">
                  × {quantity} = ${(addon.price * quantity).toFixed(2)}
                </span>
              )}
            </div>
            
            {addon.name !== 'White-Labeling' && addon.name !== 'Multilingual Support' && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={quantity <= 1 || processing}
                >
                  <MinusCircle size={20} />
                </button>
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  disabled={processing}
                >
                  <PlusCircle size={20} />
                </button>
              </div>
            )}
          </div>
          
          {/* Show a note about addon type */}
          <div className="flex items-start text-xs text-gray-500 dark:text-gray-400">
            <Info size={16} className="flex-shrink-0 mr-1.5 mt-0.5" />
            {addon.name === 'Additional Messages' ? (
              <p>This add-on provides additional message credits that can be used until exhausted.</p>
            ) : (
              <p>This add-on will be active until your current subscription period ends.</p>
            )}
          </div>
        </div>
        
        {/* Owned badge */}
        {isOwned && (
          <div className="mt-4 flex items-center text-green-600 dark:text-green-400">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span>Already purchased</span>
          </div>
        )}
        
        <div className="mt-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 p-3 rounded-md text-sm mb-4">
              {error}
            </div>
          )}
          
          {requiresSubscription ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-md text-sm text-blue-700 dark:text-blue-300">
                <div className="flex">
                  <CreditCard className="h-5 w-5 mr-2 flex-shrink-0" />
                  <p>
                    You need an active subscription to purchase add-ons. Please subscribe to a plan first.
                  </p>
                </div>
              </div>
              <Link
                to="/dashboard/subscription"
                className="block w-full bg-blue-500 hover:bg-blue-600 text-white rounded-md py-2 px-4 text-center font-medium transition-colors"
              >
                View Subscription Plans
              </Link>
            </div>
          ) : (
            <button
              onClick={handlePurchase}
              disabled={processing || isOwned || hasPendingPurchase}
              className={`w-full py-2 px-4 rounded-md font-medium ${
                isOwned
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : hasPendingPurchase
                  ? 'bg-yellow-500 text-white cursor-default'
                  : processing
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } transition-colors`}
            >
              {isOwned ? (
                'Already Purchased'
              ) : hasPendingPurchase ? (
                'Pending Purchase'
              ) : processing ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                'Purchase Add-on'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}; 