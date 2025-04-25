import React, { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, PlusCircle, MinusCircle, Compass, Rocket, TrendingUp, Briefcase, Building, X } from 'lucide-react';
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

// Define Addon type
interface Addon {
  id: number;
  name: string;
  price: number;
  description: string;
  addon_type: string;
  zoho_addon_id?: string;
  zoho_addon_code?: string;
}

// Plan icons mapping
const planIcons = {
  'Explorer': Compass,
  'Starter': Rocket,
  'Growth': TrendingUp,
  'Professional': Briefcase,
  'Enterprise': Building
};

// Plan badges
const planBadges = {
  'Growth': 'Most Popular',
  'Professional': 'Best Value'
};

// Plan accent colors
const planAccentColors = {
  'Explorer': 'blue',
  'Starter': 'green',
  'Growth': 'purple',
  'Professional': 'yellow',
  'Enterprise': 'green'
};

// Modal component props interface
interface AddonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  planId: number;
  addons: Addon[];
  selectedAddons: AddonSelectionState;
  toggleAddon: (addonId: number) => void;
  increaseQuantity: (addonId: number) => void;
  decreaseQuantity: (addonId: number) => void;
  allowsMultiple: (addonName: string) => boolean;
  formatPrice: (price: number | string | null | undefined) => string;
  planAccent: string;
}

// Modal component for add-ons
const AddonsModal = ({ 
  isOpen, 
  onClose, 
  planName, 
  planId, 
  addons, 
  selectedAddons, 
  toggleAddon, 
  increaseQuantity, 
  decreaseQuantity, 
  allowsMultiple, 
  formatPrice,
  planAccent
}: AddonsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-${planAccent}-50 dark:bg-${planAccent}-900/20`}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Optional Add-ons for {planName}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-grow">
          {addons.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No add-ons currently available
            </p>
          ) : (
            <ul className="space-y-4">
              {addons.map((addon: Addon) => (
                <li key={addon.id} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        id={`addon-${addon.id}-${planId}`}
                        checked={!!selectedAddons[addon.id]?.selected}
                        onChange={() => toggleAddon(addon.id)}
                        className={`w-4 h-4 text-${planAccent}-600 rounded border-gray-300 focus:ring-${planAccent}-500`}
                      />
                    </div>
                    <div className="ml-3 text-sm flex-1">
                      <label htmlFor={`addon-${addon.id}-${planId}`} className="font-medium text-gray-800 dark:text-gray-200">
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
              ))}
            </ul>
          )}
          
          {/* Summary section for selected addons */}
          {Object.entries(selectedAddons).some(([_, data]) => data && (data as any).selected) && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Add-ons Subtotal:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatPrice(
                    Object.entries(selectedAddons).reduce((total, [addonId, data]) => {
                      if ((data as any).selected) {
                        const addon = addons.find((a: Addon) => a.id === parseInt(addonId));
                        if (addon) {
                          return total + (Number(addon.price) * (data as any).quantity);
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
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className={`w-full px-4 py-2 bg-${planAccent}-500 hover:bg-${planAccent}-600 text-white rounded-lg font-medium flex items-center justify-center`}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export const Subscription = () => {
  const { plans, addons, isLoading, loadPlans, createCheckout, setAddons } = useSubscriptionPlans();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<AddonSelectionState>({});
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [currentModalPlan, setCurrentModalPlan] = useState<any>(null);

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
  
  // Open modal for add-ons
  const openAddonsModal = async (plan: any) => {
    if (addons.length === 0) {
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
    
    setCurrentModalPlan(plan);
    setModalOpen(true);
  };
  
  // Close modal
  const closeAddonsModal = () => {
    setModalOpen(false);
    setCurrentModalPlan(null);
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
    console.log("DEBUG - Starting getSelectedAddonIds");
    console.log("DEBUG - Current addonSelection state:", selectedAddons);
    
    const result: number[] = [];
    
    // Log all addon selection state for debugging
    Object.keys(selectedAddons).forEach(addonIdStr => {
      const addonId = Number(addonIdStr);
      const addon = selectedAddons[addonId];
      console.log(`DEBUG - Addon ID ${addonId}: selected=${addon.selected}, quantity=${addon.quantity}`);
    });
    
    Object.keys(selectedAddons).forEach(addonIdStr => {
      const addonId = Number(addonIdStr);
      const addon = selectedAddons[addonId];
      
      if (addon.selected) {
        const addonInfo = addons.find(a => a.id === addonId);
        const isMultipleAddon = addonInfo && allowsMultiple(addonInfo.name);
        
        // For add-ons that allow multiple, add them based on quantity
        if (addon.quantity > 1 && isMultipleAddon) {
          console.log(`DEBUG - Adding ${addon.quantity} instances of addon ID ${addonId}`);
          for (let i = 0; i < addon.quantity; i++) {
            result.push(addonId);
          }
        } else {
          console.log(`DEBUG - Adding single instance of addon ID ${addonId}`);
          result.push(addonId);
        }
      } else {
        console.log(`DEBUG - Skipping addon ID ${addonId} (not selected)`);
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

  // Separate regular plans and enterprise plans
  const regularPlans = plans.filter(plan => plan.name !== 'Enterprise');
  const enterprisePlan = plans.find(plan => plan.name === 'Enterprise');

  // Get plan accent color
  const getPlanAccentColor = (planName: string) => {
    return planAccentColors[planName as keyof typeof planAccentColors] || 'blue';
  };

  // Get selected addon count for a plan
  const getSelectedAddonCount = () => {
    return Object.values(selectedAddons).filter(addon => addon.selected).length;
  };

  // Render a plan card
  const renderPlanCard = (plan: any) => {
    const PlanIcon = planIcons[plan.name as keyof typeof planIcons] || Compass;
    const planAccent = getPlanAccentColor(plan.name);
    const isCurrent = currentPlanId === plan.id;
    const hasBadge = planBadges[plan.name as keyof typeof planBadges];
    const selectedAddonCount = getSelectedAddonCount();

    return (
      <div
        key={plan.id}
        className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 transition-all hover:shadow-xl transform hover:-translate-y-1 border-t-4 ${
          isCurrent
            ? `ring-2 ring-${planAccent}-500 dark:ring-${planAccent}-400 border-${planAccent}-500`
            : `hover:border-${planAccent}-500 border-transparent`
        }`}
      >
        {/* Plan Badge */}
        {hasBadge && (
          <div className={`absolute -top-3 -right-3 bg-${planAccent}-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md`}>
            {hasBadge}
          </div>
        )}
        
        {/* Current Plan Indicator */}
        {isCurrent && (
          <div className="absolute -top-3 -left-3 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
            Current
          </div>
        )}
        
        <div className="flex items-center mb-4">
          <div className={`p-2 rounded-lg bg-${planAccent}-100 dark:bg-${planAccent}-900/30 mr-3`}>
            <PlanIcon className={`w-6 h-6 text-${planAccent}-500 dark:text-${planAccent}-400`} />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {plan.name}
          </h3>
        </div>
        
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
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.word_count_limit.toLocaleString()} words/month
              </span>
            </li>
          )}
          {plan.storage_limit && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.storage_limit} storage
              </span>
            </li>
          )}
          {plan.chatbot_limit && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.chatbot_limit} {plan.chatbot_limit === 1 ? 'chatbot' : 'chatbots'}
              </span>
            </li>
          )}
          {plan.website_crawl_limit && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.website_crawl_limit}
              </span>
            </li>
          )}
          {plan.message_limit && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.message_limit.toLocaleString()} messages/month
              </span>
            </li>
          )}
          {plan.youtube_grounding && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                YouTube grounding
              </span>
            </li>
          )}
          {plan.multi_website_deployment && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                Multi-website deployment
              </span>
            </li>
          )}
          {plan.ui_customization && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.ui_customization} UI customization
              </span>
            </li>
          )}
          {plan.analytics && plan.analytics !== 'None' && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.analytics} analytics
              </span>
            </li>
          )}
          {plan.admin_user_limit && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.admin_user_limit} admin {plan.admin_user_limit === '1' ? 'user' : 'users'}
              </span>
            </li>
          )}
          {plan.support_level && plan.support_level !== 'None' && (
            <li className="flex items-start">
              <Check className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`} />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.support_level} support
              </span>
            </li>
          )}
        </ul>
        
        {/* Add-ons Button (now opens modal) */}
        {addons.length > 0 && (
          <button
            onClick={() => openAddonsModal(plan)}
            className={`text-${planAccent}-600 hover:text-${planAccent}-800 dark:text-${planAccent}-400 dark:hover:text-${planAccent}-300 font-medium text-sm flex items-center justify-center w-full border border-${planAccent}-400 rounded-md py-2 mt-6 transition-colors hover:bg-${planAccent}-50 dark:hover:bg-${planAccent}-900/20`}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Optional Extras
            {selectedAddonCount > 0 && (
              <span className={`ml-2 bg-${planAccent}-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center`}>
                {selectedAddonCount}
              </span>
            )}
          </button>
        )}
        
        <button
          className={`mt-6 w-full px-4 py-2 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center ${
            currentPlanId === plan.id
              ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-default'
              : processingPlanId === plan.id 
                ? `bg-${planAccent}-400 text-white cursor-wait`
                : `bg-${planAccent}-500 hover:bg-${planAccent}-600 text-white shadow-md hover:shadow-lg`
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
    );
  };

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
        <>
          {/* Regular Plans (4 horizontally) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {regularPlans.map(renderPlanCard)}
          </div>
          
          {/* Enterprise Plan (Separate section) */}
          {enterprisePlan && (
            <div className="mt-12 pt-12 border-t border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
                For Large Organizations
              </h2>
              <div className="max-w-3xl mx-auto">
                {renderPlanCard(enterprisePlan)}
              </div>
            </div>
          )}
          
          {/* Add-ons Modal */}
          {currentModalPlan && (
            <AddonsModal
              isOpen={modalOpen}
              onClose={closeAddonsModal}
              planName={currentModalPlan.name}
              planId={currentModalPlan.id}
              addons={addons}
              selectedAddons={selectedAddons}
              toggleAddon={toggleAddon}
              increaseQuantity={increaseQuantity}
              decreaseQuantity={decreaseQuantity}
              allowsMultiple={allowsMultiple}
              formatPrice={formatPrice}
              planAccent={getPlanAccentColor(currentModalPlan.name)}
            />
          )}
        </>
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