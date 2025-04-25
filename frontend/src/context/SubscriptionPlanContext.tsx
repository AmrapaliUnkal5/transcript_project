import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi, subscriptionApi } from "../services/api";

interface SubscriptionPlan {
  id: number;
  name: string;
  price: number | string;
  word_count_limit: number;
  storage_limit: string;
  chatbot_limit: number;
  website_crawl_limit: string;
  youtube_grounding: boolean;
  message_limit: number;
  multi_website_deployment: boolean;
  ui_customization: string;
  analytics: string;
  admin_user_limit: string;
  support_level: string;
  internal_team_bots: boolean;
  custom_ai_applications: boolean;
  custom_agents: boolean;
  process_automation: boolean;
  custom_integrations: boolean;
  zoho_plan_id?: string;
  zoho_plan_code?: string;
  billing_period?: string;
  per_file_size_limit: number;
}

interface Addon {
  id: number;
  name: string;
  price: number;
  description: string;
  addon_type: string;
  zoho_addon_id?: string;
  zoho_addon_code?: string;
}

interface SubscriptionPlanContextType {
  plans: SubscriptionPlan[];
  addons: Addon[];
  getPlanById: (id: number) => SubscriptionPlan | undefined;
  isLoading: boolean;
  loadPlans: () => Promise<void>;
  setPlans: (plans: SubscriptionPlan[]) => void;
  setAddons: (addons: Addon[]) => void;
  setLoading: (loading: boolean) => void;
  createCheckout: (planId: number, addonIds?: number[]) => Promise<string>;
}

const SubscriptionPlanContext = createContext<
  SubscriptionPlanContextType | undefined
>(undefined);

export const SubscriptionPlanProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [isLoading, setLoading] = useState(false);

  // Initialize with cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem('subscriptionPlans');
    if (cachedData) {
      try {
        const { data } = JSON.parse(cachedData);
        setPlans(data);
      } catch (error) {
        console.error("Error parsing cached subscription data:", error);
      }
    } else {
      loadPlans();
    }
    
    // Load addons as well
    loadAddons();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await subscriptionApi.getPlans();
      setPlans(data);
      
      // Cache the subscription data
      localStorage.setItem('subscriptionPlans', JSON.stringify({ data }));
    } catch (error) {
      console.error("Error loading subscription plans:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadAddons = async () => {
    try {
      console.log("Attempting to load subscription addons...");
      const data = await subscriptionApi.getAddons();
      console.log("Subscription addons loaded:", data);
      setAddons(data || []);
      console.log("Addons state updated:", data?.length || 0, "addons loaded");
    } catch (error: any) {
      console.error("Error loading subscription addons:", error);
      if (error.response) {
        console.error("Error response:", error.response.status, error.response.data);
      }
    }
  };

  const getPlanById = (id: number) => plans.find((plan) => plan.id === id);

  const createCheckout = async (planId: number, addonIds?: number[]): Promise<string> => {
    try {
      console.log(`DEBUG - CONTEXT - Requesting checkout URL for plan ${planId}`);
      console.log(`DEBUG - CONTEXT - Addon IDs passed to context:`, addonIds);
      
      const checkoutUrl = await subscriptionApi.createSubscriptionCheckout(planId, addonIds);
      
      console.log(`DEBUG - CONTEXT - Checkout URL received in context: ${checkoutUrl}`);
      return checkoutUrl;
    } catch (error: any) {
      console.error("DEBUG - CONTEXT - Error creating subscription checkout in context:", error);
      console.error("DEBUG - CONTEXT - Error message:", error.message);
      throw error;
    }
  };

  return (
    <SubscriptionPlanContext.Provider 
      value={{ 
        plans, 
        addons,
        getPlanById, 
        isLoading,
        loadPlans,
        setPlans,
        setAddons,
        setLoading,
        createCheckout
      }}
    >
      {children}
    </SubscriptionPlanContext.Provider>
  );
};

export const useSubscriptionPlans = () => {
  const context = useContext(SubscriptionPlanContext);
  if (!context) {
    throw new Error(
      "useSubscriptionPlans must be used within a SubscriptionPlanProvider"
    );
  }
  return context;
};