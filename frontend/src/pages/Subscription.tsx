import React, { useEffect, useState } from "react";
import {
  Check,
  CreditCard,
  ExternalLink,
  PlusCircle,
  MinusCircle,
  Compass,
  Rocket,
  TrendingUp,
  Briefcase,
  Building,
  X,
  AlertTriangle,
} from "lucide-react";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";
import { useAuth } from "../context/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { authApi, subscriptionApi } from "../services/api";
import { toast } from "react-toastify";

// Interface for addon selection state
interface AddonSelectionState {
  [addonId: number]: {
    selected: boolean;
    quantity: number;
  };
} 

interface PlanAddonSelection {
  [planId: number]: AddonSelectionState;
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
  Explorer: Compass,
  Starter: Rocket,
  Growth: TrendingUp,
  Professional: Briefcase,
  Enterprise: Building,
};

// Plan badges
const planBadges = {
  Growth: "Most Popular",
  Professional: "Best Value",
};

// Plan accent colors
const planAccentColors = {
  Explorer: "blue",
  Starter: "green",
  Growth: "purple",
  Professional: "yellow",
  Enterprise: "green",
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
  planAccent,
}: AddonsModalProps) => {
  // Check if modal should be shown and selectedAddons is properly initialized
  if (!isOpen || !selectedAddons) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div
          className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-${planAccent}-50 dark:bg-${planAccent}-900/20`}
        >
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
                <li
                  key={addon.id}
                  className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700"
                >
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
                      <label
                        htmlFor={`addon-${addon.id}-${planId}`}
                        className="font-medium text-gray-800 dark:text-gray-200"
                      >
                        {addon.name}
                      </label>
                      <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs">
                        {addon.description}
                      </p>

                      {/* Quantity controls for addons that support multiple selection */}
                      {selectedAddons[addon.id]?.selected &&
                        allowsMultiple(addon.name) && (
                          <div className="flex items-center mt-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 mr-2">
                              Quantity:
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                decreaseQuantity(addon.id);
                              }}
                              disabled={selectedAddons[addon.id]?.quantity <= 1}
                              className="w-6 h-6 rounded flex items-center justify-center border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                            >
                              <span>-</span>
                            </button>
                            <span className="mx-2 text-gray-800 dark:text-gray-200 text-sm">
                              {selectedAddons[addon.id]?.quantity || 1}
                            </span>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                increaseQuantity(addon.id);
                              }}
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
                      {selectedAddons[addon.id]?.selected &&
                        selectedAddons[addon.id]?.quantity > 1 && (
                          <span className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            Total:{" "}
                            {formatPrice(
                              Number(addon.price) *
                                selectedAddons[addon.id]?.quantity
                            )}
                          </span>
                        )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Summary section for selected addons */}
          {Object.entries(selectedAddons).some(
            ([_, data]) => data && (data as any).selected
          ) && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Add-ons Subtotal:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatPrice(
                    Object.entries(selectedAddons).reduce(
                      (total, [addonId, data]) => {
                        if ((data as any).selected) {
                          const addon = addons.find(
                            (a: Addon) => a.id === parseInt(addonId)
                          );
                          if (addon) {
                            return (
                              total +
                              Number(addon.price) * (data as any).quantity
                            );
                          }
                        }
                        return total;
                      },
                      0
                    )
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
  const { plans, addons, isLoading, loadPlans, createCheckout, setAddons } =
    useSubscriptionPlans();
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<PlanAddonSelection>({});
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [currentModalPlan, setCurrentModalPlan] = useState<any>(null);
  const [showDowngradeWarning, setShowDowngradeWarning] = useState(false);
  const [selectedPlanForDowngrade, setSelectedPlanForDowngrade] =
    useState<any>(null);
  const location = useLocation();
  const currentPlanIdFromState = location.state?.currentPlanId;
  const fromExpired = location.state?.fromExpired;
  const [isExpiredPlan, setIsExpiredPlan] = useState(false);
  const [hasPendingSubscription, setHasPendingSubscription] = useState(false);
  const [pendingSubscriptionDetails, setPendingSubscriptionDetails] =
    useState<any>(null);
  const [showPendingNotification, setShowPendingNotification] = useState(false);
  const [effectivePlanId, setEffectivePlanId] = useState<number | null>(null);
  const [showPhoneModal, setShowPhoneModal] = useState(false);

  useEffect(() => {
    // Check URL params for expired or cancelled status
    const params = new URLSearchParams(window.location.search);
    setIsExpiredPlan(params.get("isExpired") === "true");
  }, []);

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
    // Initialize empty state object with plan IDs as keys
    const initialState: PlanAddonSelection = {};
    
    // Only do this if plans and addons are available
    if (plans && plans.length > 0 && addons && addons.length > 0) {
      // Create an entry for each plan
      plans.forEach(plan => {
        // Create an empty object for each plan
        const planAddons: AddonSelectionState = {};
        
        // Initialize each addon with default values
        addons.forEach(addon => {
          planAddons[addon.id] = {
            selected: false,
            quantity: 1,
          };
        });
        
        // Add the plan's addons to the state
        initialState[plan.id] = planAddons;
      });
      
      setSelectedAddons(initialState);
      console.log("DEBUG - Initialized addon selection state:", initialState);
    }
  }, [addons, plans]);

  // Determine current plan based on user's subscription
  const currentPlanId = user?.subscription_plan_id;
  console.log("currentPlanId in Subscription.tsx page", currentPlanId);

  // Toggle addon selection
  const toggleAddon = (planId: number, addonId: number) => {
  setSelectedAddons(prev => ({
    ...prev,
    [planId]: {
      ...prev[planId],
      [addonId]: {
        ...prev[planId]?.[addonId],
        selected: !prev[planId]?.[addonId]?.selected,
      },
    },
  }));
};

  // Open modal for add-ons
  const openAddonsModal = async (plan: any) => {
    setSelectedAddons(prev => {
      // Only initialize addons for this plan if they don't exist yet
      if (!prev[plan.id]) {
        const planAddons: AddonSelectionState = {};
        
        // Initialize each addon with default values
        addons.forEach(addon => {
          planAddons[addon.id] = {
            selected: false,
            quantity: 1,
          };
        });
        
        return {
          ...prev,
          [plan.id]: planAddons,
        };
      }
      return prev;
    });
    
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
 const increaseQuantity = (planId: number, addonId: number) => {
  setSelectedAddons(prev => ({
    ...prev,
    [planId]: {
      ...prev[planId],
      [addonId]: {
        ...prev[planId]?.[addonId],
        quantity: (prev[planId]?.[addonId]?.quantity || 1) + 1,
      },
    },
  }));
};

  // Decrease quantity for an addon
 const decreaseQuantity = (planId: number, addonId: number) => {
  setSelectedAddons(prev => {
    const currentQuantity = prev[planId]?.[addonId]?.quantity || 1;
    if (currentQuantity <= 1) return prev;

    return {
      ...prev,
      [planId]: {
        ...prev[planId],
        [addonId]: {
          ...prev[planId]?.[addonId],
          quantity: currentQuantity - 1,
        },
      },
    };
  });
};

  // Check if an addon allows multiple selection (quantity > 1)
  const allowsMultiple = (addonName: string): boolean => {
    return addonName.startsWith("Additional");
  };

  // Get selected addon IDs with quantities
  const getSelectedAddonIds = (planId: number) => {
    const planAddons = selectedAddons[planId] || {};
    const result: number[] = [];

    Object.keys(planAddons).forEach(addonIdStr => {
      const addonId = Number(addonIdStr);
      const addon = planAddons[addonId];
      
      // Check if addon exists before trying to access its properties
      if (!addon) {
        console.log(`DEBUG - Addon ID ${addonId}: not found in selections`);
        return;
      }
      
      console.log(
      `DEBUG - Addon ID ${addonId}: selected=${addon.selected}, quantity=${addon.quantity}`
    );

      if (addon.selected) {
        const addonInfo = addons.find(a => a.id === addonId);
        const isMultipleAddon = addonInfo && allowsMultiple(addonInfo.name);


        if (addon.quantity > 1 && isMultipleAddon) {

          for (let i = 0; i < addon.quantity; i++) {
            result.push(addonId);
          }
        }
         else {
          result.push(addonId);
        }

      }
  });

  return result;
};

  const handleSubscribe = async (planId: number) => {
    // Get the current plan ID and the selected plan
    const currentPlan = plans.find((p) => p.id === currentPlanId);
    const selectedPlan = plans.find((p) => p.id === planId);

    // Always prevent downgrades, regardless of expiration status
    if (currentPlan && selectedPlan && selectedPlan.id < currentPlan.id) {
      setSelectedPlanForDowngrade(selectedPlan);
      setShowDowngradeWarning(true);
      return;
    }

    try {
      // Set the processing plan to show loading state
      setProcessingPlanId(planId);
      setError(null);

      // Get selected addon IDs
      const addonIds = getSelectedAddonIds(planId);

      const endpoint = isExpiredPlan ? "renewSubscription" : "createCheckout";
      console.log(
        `DEBUG - Calling ${endpoint} with planId=${planId}, addonIds=`,
        addonIds
      );

      console.log("DEBUG - Initiating subscription checkout");
      console.log(`DEBUG - Plan ID: ${planId}`);
      console.log(`DEBUG - Selected addon IDs: ${addonIds.join(", ")}`);

      // Get checkout URL from backend
      console.log(
        `DEBUG - Calling createCheckout with planId=${planId}, addonIds=`,
        addonIds
      );
      const checkoutUrl = await createCheckout(
        planId,
        addonIds.length > 0 ? addonIds : undefined
      );

      console.log(`DEBUG - Received checkout URL: ${checkoutUrl}`);

      if (!checkoutUrl) {
        console.error("DEBUG - Empty checkout URL received");
        throw new Error("Failed to generate checkout URL");
      }

      // Log success before redirect
      console.log(
        "DEBUG - Successfully created checkout URL, redirecting to:",
        checkoutUrl
      );

      // Short timeout to ensure logs are sent before redirect
      setTimeout(() => {
        // Redirect to Zoho's hosted checkout page
        window.open(checkoutUrl, '_blank');
      }, 100);
    } catch (error: any) {
      console.error("DEBUG - Error creating subscription checkout:", error);
      
      // Check if this is the phone number required error
      if (error.name === "PhoneNumberRequiredError") {
        setShowPhoneModal(true);
        return;
      }
      
      let errorMessage =
        "Failed to set up subscription. Please try again later.";

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
    if (price === null || price === undefined) return "Custom";
    if (
      typeof price === "string" &&
      (price.toLowerCase() === "custom" || price === "")
    )
      return "Custom";
    return `$${Number(price).toFixed(2)}`;
  };

  // Check if the plan has annual billing
  const isAnnualBilling = (plan: any) =>
    plan.billing_period?.toLowerCase() === "yearly" ||
    plan.billing_period?.toLowerCase() === "annual";

  // Separate regular plans and enterprise plans
  const regularPlans = plans.filter((plan) => plan.name !== "Enterprise");
  const enterprisePlan = plans.find((plan) => plan.name === "Enterprise");

  // Get plan accent color
  const getPlanAccentColor = (planName: string) => {
    return (
      planAccentColors[planName as keyof typeof planAccentColors] || "blue"
    );
  };

  // Get selected addon count for a plan
  const getSelectedAddonCount = (planId: number) => {
   return Object.values(selectedAddons[planId] || {}).filter(addon => addon.selected).length;
  };

  useEffect(() => {
    const checkFreePlanValidity = async () => {
      if (currentPlanId === 1 && user?.user_id) {
        try {
          const response = await authApi.checkUserSubscription(user.user_id);
          if (!response.exists) {
            setEffectivePlanId(null); // treat as no current plan
          } else {
            setEffectivePlanId(currentPlanId); // valid free plan
          }
        } catch (err) {
          console.error("Failed to validate free plan", err);
          setEffectivePlanId(currentPlanId); // fallback to original
        }
      } else {
        setEffectivePlanId(currentPlanId ?? null); // plans other than 1
      }
    };

    checkFreePlanValidity();
  }, [currentPlanId, user?.user_id]);

  // Render a plan card
  const renderPlanCard = (plan: any) => {
    const PlanIcon = planIcons[plan.name as keyof typeof planIcons] || Compass;
    const planAccent = getPlanAccentColor(plan.name);
    const isCurrent = effectivePlanId === plan.id; //changed
    const hasBadge = planBadges[plan.name as keyof typeof planBadges];
    const selectedAddonCount = getSelectedAddonCount(plan.id);
    const isExpiredCurrentPlan = isCurrent && isExpiredPlan;
    const isCancelled = user?.subscription_status === "cancelled";
    console.log("effectivePlanId", effectivePlanId);

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
          <div
            className={`absolute -top-3 -right-3 bg-${planAccent}-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md`}
          >
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
          <div
            className={`p-2 rounded-lg bg-${planAccent}-100 dark:bg-${planAccent}-900/30 mr-3`}
          >
            <PlanIcon
              className={`w-6 h-6 text-${planAccent}-500 dark:text-${planAccent}-400`}
            />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {plan.name}
          </h3>
        </div>

        <div className="mt-4 flex items-baseline">
          <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
            {formatPrice(plan.price)}
          </span>
          {plan.price !== null &&
            plan.price !== undefined &&
            plan.price !== "Custom" && (
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                /{isAnnualBilling(plan) ? "year" : "month"}
              </span>
            )}
        </div>

        <ul className="mt-6 space-y-3">
          {plan.word_count_limit && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.word_count_limit.toLocaleString()} words/month
              </span>
            </li>
          )}
          {plan.storage_limit && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.storage_limit} storage
              </span>
            </li>
          )}
          {plan.chatbot_limit && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.chatbot_limit}{" "}
                {plan.chatbot_limit === 1 ? "chatbot" : "chatbots"}
              </span>
            </li>
          )}
          {plan.website_crawl_limit && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.website_crawl_limit}
              </span>
            </li>
          )}
          {plan.message_limit && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.message_limit.toLocaleString()} messages/month
              </span>
            </li>
          )}
          {plan.youtube_grounding && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                YouTube grounding
              </span>
            </li>
          )}
          {plan.multi_website_deployment && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                Multi-website deployment
              </span>
            </li>
          )}
          {plan.ui_customization && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.ui_customization} UI customization
              </span>
            </li>
          )}
          {plan.analytics && plan.analytics !== "None" && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.analytics} analytics
              </span>
            </li>
          )}
          {plan.admin_user_limit && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.admin_user_limit} admin{" "}
                {plan.admin_user_limit === "1" ? "user" : "users"}
              </span>
            </li>
          )}
          {plan.support_level && plan.support_level !== "None" && (
            <li className="flex items-start">
              <Check
                className={`w-5 h-5 text-${planAccent}-500 mr-2 flex-shrink-0`}
              />
              <span className="text-gray-600 dark:text-gray-300">
                {plan.support_level} support
              </span>
            </li>
          )}
        </ul>

        {/* Add-ons Button (now opens modal) */}
        {plan.name.toLowerCase() !== "enterprise" && plan.name.toLowerCase() !== "explorer" && addons.length > 0 && (
          <button
            onClick={() => openAddonsModal(plan)}
            className={`text-${planAccent}-600 hover:text-${planAccent}-800 dark:text-${planAccent}-400 dark:hover:text-${planAccent}-300 font-medium text-sm flex items-center justify-center w-full border border-${planAccent}-400 rounded-md py-2 mt-6 transition-colors hover:bg-${planAccent}-50 dark:hover:bg-${planAccent}-900/20`}
          >
            <PlusCircle className="w-4 h-4 mr-2" />
            Add Optional Extras
            {selectedAddonCount > 0 && (
              <span
                className={`ml-2 bg-${planAccent}-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center`}
              >
                {selectedAddonCount}
              </span>
            )}
          </button>
        )}

        <button
          className={`mt-6 w-full px-4 py-2 rounded-lg transition-all transform hover:scale-105 flex items-center justify-center ${
            isCurrent && !isExpiredPlan
              ? "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 cursor-default"
              : processingPlanId === plan.id
              ? `bg-${planAccent}-400 text-white cursor-wait`
              : `bg-${planAccent}-500 hover:bg-${planAccent}-600 text-white shadow-md hover:shadow-lg`
          }`}
          disabled={(isCurrent && !isExpiredPlan) || processingPlanId !== null}
          onClick={() => {
                if (plan.name.toLowerCase() === "enterprise") {
            navigate("/customersupport"); // Redirect to Customer Support
          } else if (plan.name.toLowerCase() === "explorer" && !effectivePlanId) {
            navigate("/create-bot");
          } else {
            handleSubscribe(plan.id);
          }
          }}
        >
          {plan.name.toLowerCase() === "enterprise" ? (
    "Contact Us" // Changed from "Subscribe" to "Contact Us"
  ) : plan.name.toLowerCase() === "explorer" && !effectivePlanId ? (
            "Continue with Free Plan"
          ) : isCurrent ? (
            isExpiredPlan ? (
              isCancelled ? (
                "Subscribe Again"
              ) : (
                "Renew Plan"
              )
            ) : (
              "Current Plan"
            )
          ) : processingPlanId === plan.id ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : currentPlanId && plan.id < currentPlanId ? (
            "Subscribe"
          ) : (
            <>
              Subscribe <ExternalLink className="ml-2 h-4 w-4" />
            </>
          )}
        </button>
      </div>
    );
  };

  const DowngradeWarningDialog = () => {
    if (!showDowngradeWarning || !selectedPlanForDowngrade) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Plan Downgrade Warning
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            If you downgrade your plan, you may lose access to some features,
            bot count, or additional usage.
          </p>
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setShowDowngradeWarning(false)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Cancel
            </button>
            {/* <button
              onClick={() => {
                setShowDowngradeWarning(false);
                handleSubscribe(selectedPlanForDowngrade.id);
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
            >
              Proceed with Downgrade
            </button> */}
          </div>
        </div>
      </div>
    );
  };

  // Check for pending subscriptions when component mounts
  useEffect(() => {
    const checkPendingSubscriptions = async () => {
      if (user?.user_id) {
        try {
          const subscriptionStatus =
            await subscriptionApi.getSubscriptionStatus(user.user_id);
          if (subscriptionStatus && subscriptionStatus.status === "pending") {
            setHasPendingSubscription(true);
            setPendingSubscriptionDetails(subscriptionStatus);
            setShowPendingNotification(true);
          } else {
            setHasPendingSubscription(false);
            setPendingSubscriptionDetails(null);
          }
        } catch (error) {
          console.error("Error checking pending subscriptions:", error);
        }
      }
    };

    checkPendingSubscriptions();
  }, [user?.user_id]);

  // Handle abandoned checkout
  const handleAbandonedCheckout = async (action: "continue" | "cancel") => {
    if (!pendingSubscriptionDetails) return;

    try {
      if (action === "continue") {
        // Re-use existing pending subscription to generate a new checkout URL
        const checkoutUrl = await subscriptionApi.resumeCheckout(
          pendingSubscriptionDetails.id
        );
        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          throw new Error("Failed to generate checkout URL");
        }
      } else {
        // Cancel the pending subscription
        await subscriptionApi.cancelPendingSubscription(
          pendingSubscriptionDetails.id
        );
        setHasPendingSubscription(false);
        setPendingSubscriptionDetails(null);
        setShowPendingNotification(false);

        // Refresh user data to make sure we have the latest state
        await refreshUserData();
      }
    } catch (error) {
      console.error("Error handling abandoned checkout:", error);
      setError(error instanceof Error ? error.message : "An error occurred");
    }
  };

  // Render the pending subscription notification
  const renderPendingSubscriptionNotification = () => {
    if (!showPendingNotification || !pendingSubscriptionDetails) return null;

    const pendingPlan = plans.find(
      (p) => p.id === pendingSubscriptionDetails.subscription_plan_id
    );
    const planName = pendingPlan?.name || "Selected plan";

    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-6 mb-8">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle
              className="h-5 w-5 text-yellow-500"
              aria-hidden="true"
            />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Incomplete Checkout Detected
            </h3>
            <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              <p>
                You have an incomplete checkout for the{" "}
                <strong>{planName}</strong> plan. Would you like to continue
                with this checkout or start a new one?
              </p>
              <div className="mt-4 flex space-x-4">
                <button
                  onClick={() => handleAbandonedCheckout("continue")}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md transition-colors"
                >
                  Continue Checkout
                </button>
                <button
                  onClick={() => handleAbandonedCheckout("cancel")}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                >
                  Cancel & Start Fresh
                </button>
                <button
                  onClick={() => setShowPendingNotification(false)}
                  className="px-4 py-2 bg-transparent text-yellow-700 dark:text-yellow-300 hover:text-yellow-800 dark:hover:text-yellow-200"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PhoneNumberRequiredModal = () => (
    showPhoneModal ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto text-center">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Phone Number Required</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            A phone number is required to subscribe. Please go to your <b>Account</b> page, add your phone number, and then return here to subscribe.
          </p>
          <button
            onClick={() => {
              setShowPhoneModal(false);
              navigate('/myaccount');
            }}
            className="px-4 py-2 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
          >
            Go to Account Page
          </button>
        </div>
      </div>
    ) : null
  );

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

      {/* Pending subscription notification */}
      {renderPendingSubscriptionNotification()}

      {/* Error message */}
      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">
            No subscription plans available
          </p>
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
              selectedAddons={selectedAddons[currentModalPlan.id] || {}}
              toggleAddon={(addonId) => toggleAddon(currentModalPlan.id, addonId)}
              increaseQuantity={(addonId) => increaseQuantity(currentModalPlan.id, addonId)}
              decreaseQuantity={(addonId) => decreaseQuantity(currentModalPlan.id, addonId)}
              allowsMultiple={allowsMultiple}
              formatPrice={formatPrice}
              planAccent={getPlanAccentColor(currentModalPlan.name)}
            />
          )}
          <DowngradeWarningDialog />
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
              Your subscription is managed through Zoho Billing. To manage your
              billing details, payment methods, or cancel your subscription,
              please visit your Zoho Customer Portal.
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
      <PhoneNumberRequiredModal />
    </div>
  );
};
