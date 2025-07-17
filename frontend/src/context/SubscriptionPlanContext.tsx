import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi,subscriptionApi } from "../services/api";

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
  per_file_size_limit: number;
}

interface AddonPlan {
  id: number;
  name: string;
  price: number;
  description: string;
  addon_type: string;
  zoho_addon_id?: string;
  zoho_addon_code?: string;
  additional_word_limit: number;
  additional_message_limit: number;
}

interface SubscriptionPlanContextType {
  plans: SubscriptionPlan[];
  addons: AddonPlan[];
  getPlanById: (id: number) => SubscriptionPlan | undefined;
  getAddonById: (id: number) => AddonPlan | undefined;
  isLoading: boolean;
  loadPlans: () => Promise<void>;
  setPlans: (plans: SubscriptionPlan[]) => void;
  setAddons: (addons: AddonPlan[]) => void;
  setLoading: (loading: boolean) => void;
  createCheckout: (planId: number, addonIds?: number[]) => Promise<string>;
  purchaseAddon: (addonId: number, quantity?: number, isContinuation?: boolean) => Promise<string>;
}



const SubscriptionPlanContext = createContext<SubscriptionPlanContextType | undefined>(undefined);

export const SubscriptionPlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [addons, setAddons] = useState<AddonPlan[]>([]);
  const [isLoading, setLoading] = useState(false);

  useEffect(() => {
    const cachedPlans = localStorage.getItem('subscriptionPlans');
    const cachedAddons = localStorage.getItem('addonPlans');
  
    // Handle subscription plans
    if (cachedPlans) {
      try {
        const { data } = JSON.parse(cachedPlans);
        setPlans(data);
      } catch (error) {
        console.error("Error parsing cached subscription data:", error);
        loadPlans(); // Fallback to API call
      }
    } else {
      loadPlans();
    }
  
    // Handle addon plans
    if (cachedAddons) {
      try {
        const { data } = JSON.parse(cachedAddons);
        setAddons(data);
      } catch (error) {
        console.error("Error parsing cached addon data:", error);
        loadAddons(); // Fallback to API call
      }
    } else {
      loadAddons();
    }
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
  const getAddonById = (id: number) => addons.find((addon) => addon.id === id);

  const createCheckout = async (planId: number, addonIds?: number[]) => {
    try {
      return await subscriptionApi.createSubscriptionCheckout(planId, addonIds);
    } catch (error) {
      console.error("Error creating checkout:", error);
      throw error;
    }
  };
  
  const purchaseAddon = async (addonId: number, quantity: number = 1, isContinuation: boolean = false) => {
    try {
      if (isContinuation) {
        return await subscriptionApi.purchaseAddon(addonId, quantity);
      }
      return await subscriptionApi.purchaseAddon(addonId, quantity);
    } catch (error) {
      console.error("Error purchasing addon:", error);
      throw error;
    }
  };

  const contextValue = {
    plans,
    addons,
    getPlanById,
    getAddonById,
    isLoading,
    loadPlans,
    setPlans,
    setAddons,
    setLoading,
    createCheckout,
    purchaseAddon
  };

  return (
    <SubscriptionPlanContext.Provider 
      value={contextValue}
    >
      {children}
    </SubscriptionPlanContext.Provider>
  );
};

export const useSubscriptionPlans = ():SubscriptionPlanContextType  => {
  const context = useContext(SubscriptionPlanContext);
  if (!context) {
    throw new Error("useSubscriptionPlans must be used within a SubscriptionPlanProvider");
  }
  return context;
};

export const useAddonPlans = () => {
  const context = useContext(SubscriptionPlanContext);
  if (!context) {
    throw new Error("useAddonPlans must be used within a SubscriptionPlanProvider");
  }
  return context; 
};