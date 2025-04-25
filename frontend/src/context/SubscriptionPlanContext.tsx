import React, { createContext, useContext, useEffect, useState } from "react";
import { authApi } from "../services/api";

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
interface SubscriptionPlanContextType {
  plans: SubscriptionPlan[];
  getPlanById: (id: number) => SubscriptionPlan | undefined;
  isLoading: boolean;
  setPlans: (plans: SubscriptionPlan[]) => void; // Add this
  setLoading: (loading: boolean) => void; // Add this
}

const SubscriptionPlanContext = createContext<
  SubscriptionPlanContextType | undefined
>(undefined);

export const SubscriptionPlanProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setLoading] = useState(false);

  // Initialize with cached data on mount
  useEffect(() => {
    const cachedData = localStorage.getItem('subscriptionPlans');
    if (cachedData) {
      const { data } = JSON.parse(cachedData);
      setPlans(data);
    }
  }, []);

  const getPlanById = (id: number) => plans.find((plan) => plan.id === id);

  return (
    <SubscriptionPlanContext.Provider 
      value={{ 
        plans, 
        getPlanById, 
        isLoading,
        setPlans, // Expose setter
        setLoading // Expose setter
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