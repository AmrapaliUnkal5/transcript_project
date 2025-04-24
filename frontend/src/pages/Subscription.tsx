import React, { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, PlusCircle, MinusCircle } from 'lucide-react';
import { useSubscriptionPlans } from '../context/SubscriptionPlanContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscriptionApi } from '../services/api';

// Interface for addon selection state
interface AddonSelectionState {
  [addonId: number]: {
    selected: boolean;
    quantity: number;
  };
}

export const Subscription = () => {
  const { plans, addons, isLoading, loadPlans, createCheckout, setAddons } = useSubscriptionPlans();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<AddonSelectionState>({});
  const [showAddons, setShowAddons] = useState<{[planId: number]: boolean}>({});

  useEffect(() => {
    // Reload plans when component mounts to ensure fresh data
    loadPlans();
    
    // Debug log for addons
    console.log("Current addons in context:", addons);
  }, []);

  // Debug log when addons change
  useEffect(() => {
    console.log("Addons updated:", addons);
  }, [addons]);

  // Initialize addon selection state when addons change
  useEffect(() => {
    const initialState: AddonSelectionState = {};
    addons.forEach(addon => {
      initialState[addon.id] = {
        selected: false,
        quantity: 1
      };
    });
    setSelectedAddons(initialState);
  }, [addons]);

  // Determine current plan based on user's subscription
  const currentPlanId = user?.subscription_plan_id;
  
  // Toggle addon selection
  const toggleAddon = (addonId: number) => {
    setSelectedAddons(prev => ({
      ...prev,
      [addonId]: {
        ...prev[addonId],
        selected: !prev[addonId]?.selected
      }
    }));
  };
  
  // Toggle showing addons for a plan
  const toggleShowAddons = async (planId: number) => {
    // If we're showing the addons section and we currently have no addons, try loading them
    if (!showAddons[planId] && addons.length === 0) {
      console.log("No addons loaded yet, attempting to load them directly");
      try {
        const addonData = await subscriptionApi.getAddons();
        if (addonData && addonData.length > 0) {
          console.log("Successfully loaded addons directly:", addonData);
          setAddons(addonData);
        } else {
          console.log("No addons returned from direct API call");
        }
      } catch (error) {
        console.error("Error loading addons directly:", error);
      }
    }
    
    setShowAddons(prev => ({
      ...prev,
      [planId]: !prev[planId]
    }));
  };
  
  // Increase quantity for an addon
  const increaseQuantity = (addonId: number) => {
    setSelectedAddons(prev => ({
      ...prev,
      [addonId]: {
        ...prev[addonId],
        quantity: (prev[addonId]?.quantity || 1) + 1
      }
    }));
  };

  // Decrease quantity for an addon
  const decreaseQuantity = (addonId: number) => {
    setSelectedAddons(prev => {
      const currentQuantity = prev[addonId]?.quantity || 1;
      if (currentQuantity <= 1) return prev;
      
      return {
        ...prev,
        [addonId]: {
          ...prev[addonId],
          quantity: currentQuantity - 1
        }
      };
    });
  };

  // Check if an addon allows multiple selection (quantity > 1)
  const allowsMultiple = (addonName: string): boolean => {
    return addonName.startsWith('Additional');
  };

  // Get selected addon IDs with quantities
  const getSelectedAddonIds = () => {
    const result: number[] = [];
    
    console.log("DEBUG - Getting selected addon IDs from:", selectedAddons);
    
    Object.entries(selectedAddons).forEach(([addonId, data]) => {
      if (data.selected) {
        const id = parseInt(addonId);
        const addon = addons.find(a => a.id === id);
        console.log(`DEBUG - Selected addon: ${addon?.name} (ID: ${id}), Quantity: ${data.quantity}`);
        
        if (addon && allowsMultiple(addon.name)) {
          // Add the addon ID multiple times based on quantity
          console.log(`DEBUG - Adding multiple instances of addon ID ${id} (${data.quantity} times)`);
          for (let i = 0; i < data.quantity; i++) {
            result.push(id);
          }
        } else {
          // For regular addons, just add once
          console.log(`DEBUG - Adding single instance of addon ID ${id}`);
          result.push(id);
        }
      }
    });
    
    console.log("DEBUG - Final selected addon IDs array:", result);
    return result;
  };

  const handleSubscribe = async (planId: number) => {
    try {
      // Set the processing plan to show loading state
      setProcessingPlanId(planId);
      setError(null);
      
      // Get selected addon IDs
      const addonIds = getSelectedAddonIds();
      
      console.log("DEBUG - Initiating subscription checkout");
      console.log(`DEBUG - Plan ID: ${planId}`);
      console.log(`DEBUG - Selected addon IDs: ${addonIds.join(', ')}`);
      
      // Get checkout URL from backend
      console.log(`DEBUG - Calling createCheckout with planId=${planId}, addonIds=`, addonIds);
      const checkoutUrl = await createCheckout(planId, addonIds.length > 0 ? addonIds : undefined);
      
      console.log(`DEBUG - Received checkout URL: ${checkoutUrl}`);
      
      if (!checkoutUrl) {
        console.error('DEBUG - Empty checkout URL received');
        throw new Error('Failed to generate checkout URL');
      }
      
      // Log success before redirect
      console.log('DEBUG - Successfully created checkout URL, redirecting to:', checkoutUrl);
      
      // Short timeout to ensure logs are sent before redirect
      setTimeout(() => {
        // Redirect to Zoho's hosted checkout page
        window.location.href = checkoutUrl;
      }, 100);
      
    } catch (error) {
      console.error('DEBUG - Error creating subscription checkout:', error);
      let errorMessage = 'Failed to set up subscription. Please try again later.';
      
      // If there's a more specific error message, use it
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setProcessingPlanId(null);
    }
  };

  // Format price for display
  const formatPrice = (price: number | string | null | undefined) => {
    if (price === null || price === undefined) return 'Custom';
    if (typeof price === 'string' && (price.toLowerCase() === 'custom' || price === '')) return 'Custom';
    return `$${Number(price).toFixed(2)}`;
  };

  // Check if the plan has annual billing
  const isAnnualBilling = (plan: any) => 
    plan.billing_period?.toLowerCase() === 'yearly' || 
    plan.billing_period?.toLowerCase() === 'annual';

  return (
    <div className="space-y-8 px-4 py-6 max-w-7xl mx-auto">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Subscription Plans
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Choose the plan that best fits your needs
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No subscription plans available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-all ${
                currentPlanId === plan.id
                  ? 'ring-2 ring-blue-500 dark:ring-blue-400'
                  : 'hover:shadow-lg'
              }`}
            >
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                  {formatPrice(plan.price)}
                </span>
                {plan.price !== null && plan.price !== undefined && plan.price !== 'Custom' && (
                  <span className="ml-1 text-gray-500 dark:text-gray-400">
                    /{isAnnualBilling(plan) ? 'year' : 'month'}
                  </span>
                )}
              </div>
              <ul className="mt-6 space-y-3">
                {plan.word_count_limit && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.word_count_limit.toLocaleString()} words/month
                    </span>
                  </li>
                )}
                {plan.storage_limit && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.storage_limit} storage
                    </span>
                  </li>
                )}
                {plan.chatbot_limit && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.chatbot_limit} {plan.chatbot_limit === 1 ? 'chatbot' : 'chatbots'}
                    </span>
                  </li>
                )}
                {plan.website_crawl_limit && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.website_crawl_limit}
                    </span>
                  </li>
                )}
                {plan.message_limit && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.message_limit.toLocaleString()} messages/month
                    </span>
                  </li>
                )}
                {plan.youtube_grounding && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      YouTube grounding
                    </span>
                  </li>
                )}
                {plan.multi_website_deployment && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      Multi-website deployment
                    </span>
                  </li>
                )}
                {plan.ui_customization && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.ui_customization} UI customization
                    </span>
                  </li>
                )}
                {plan.analytics && plan.analytics !== 'None' && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.analytics} analytics
                    </span>
                  </li>
                )}
                {plan.admin_user_limit && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.admin_user_limit} admin {plan.admin_user_limit === '1' ? 'user' : 'users'}
                    </span>
                  </li>
                )}
                {plan.support_level && plan.support_level !== 'None' && (
                  <li className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                    <span className="text-gray-600 dark:text-gray-300">
                      {plan.support_level} support
                    </span>
                  </li>
                )}
              </ul>
              
              {/* Addons Section */}
              {addons.length > 0  && (
                <div className="mt-4">
                  <button
                    onClick={() => toggleShowAddons(plan.id)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm flex items-center justify-center w-full border border-blue-400 rounded-md py-2 mt-4 transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {showAddons[plan.id] ? (
                      <>
                        <MinusCircle className="w-4 h-4 mr-2" />
                        Hide Optional Add-ons
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Add Optional Extras
                      </>
                    )}
                  </button>
                  
                  {showAddons[plan.id] && (
                    <div className="mt-3 border-t pt-3 border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Optional Add-ons
                      </h4>
                      <ul className="space-y-4">
                        {addons.length === 0 ? (
                          <li className="text-sm text-gray-500 dark:text-gray-400 italic">
                            No add-ons currently available
                          </li>
                        ) : (
                          addons.map(addon => (
                            <li key={addon.id} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="flex items-start">
                                <div className="flex items-center h-5">
                                  <input
                                    type="checkbox"
                                    id={`addon-${addon.id}-${plan.id}`}
                                    checked={!!selectedAddons[addon.id]?.selected}
                                    onChange={() => toggleAddon(addon.id)}
                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="ml-3 text-sm flex-1">
                                  <label htmlFor={`addon-${addon.id}-${plan.id}`} className="font-medium text-gray-800 dark:text-gray-200">
                                    {addon.name}
                                  </label>
                                  <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs">{addon.description}</p>
                                  
                                  {/* Quantity controls for addons that support multiple selection */}
                                  {selectedAddons[addon.id]?.selected && allowsMultiple(addon.name) && (
                                    <div className="flex items-center mt-2">
                                      <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">Quantity:</span>
                                      <button 
                                        onClick={(e) => { e.preventDefault(); decreaseQuantity(addon.id); }}
                                        disabled={selectedAddons[addon.id]?.quantity <= 1}
                                        className="w-6 h-6 rounded flex items-center justify-center border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                                      >
                                        <span>-</span>
                                      </button>
                                      <span className="mx-2 text-gray-800 dark:text-gray-200 text-sm">
                                        {selectedAddons[addon.id]?.quantity || 1}
                                      </span>
                                      <button 
                                        onClick={(e) => { e.preventDefault(); increaseQuantity(addon.id); }}
                                        className="w-6 h-6 rounded flex items-center justify-center border border-gray-300 dark:border-gray-600"
                                      >
                                        <span>+</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {formatPrice(addon.price)}
                                  </span>
                                  {selectedAddons[addon.id]?.selected && selectedAddons[addon.id]?.quantity > 1 && (
                                    <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Total: {formatPrice(Number(addon.price) * selectedAddons[addon.id]?.quantity)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                      
                      {/* Summary section for selected addons */}
                      {Object.entries(selectedAddons).some(([_, data]) => data.selected) && (
                        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                              Add-ons Subtotal:
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatPrice(
                                Object.entries(selectedAddons).reduce((total, [addonId, data]) => {
                                  if (data.selected) {
                                    const addon = addons.find(a => a.id === parseInt(addonId));
                                    if (addon) {
                                      return total + (Number(addon.price) * data.quantity);
                                    }
                                  }
                                  return total;
                                }, 0)
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <button
                className={`mt-8 w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                  currentPlanId === plan.id
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-default'
                    : processingPlanId === plan.id 
                      ? 'bg-blue-400 text-white cursor-wait'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                disabled={currentPlanId === plan.id || processingPlanId !== null}
                onClick={() => handleSubscribe(plan.id)}
              >
                {currentPlanId === plan.id ? (
                  'Current Plan'
                ) : processingPlanId === plan.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Subscribe <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Current Subscription Info - Only show if user has a subscription */}
      {user?.subscription_plan_id && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Current Subscription
          </h2>
          <div className="flex items-center text-blue-700 dark:text-blue-300 mb-4">
            <CreditCard className="w-5 h-5 mr-2" />
            <span>
              Your subscription is managed through Zoho Billing. To manage your billing details,
              payment methods, or cancel your subscription, please visit your Zoho Customer Portal.
            </span>
          </div>
          <a
            href="https://subscriptions.zoho.in/portal/login"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Manage Subscription <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </div>
      )}
    </div>
  );
};