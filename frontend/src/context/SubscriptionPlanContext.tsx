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
}

interface SubscriptionPlanContextType {
  plans: SubscriptionPlan[];
  getPlanById: (id: number) => SubscriptionPlan | undefined;
}

const SubscriptionPlanContext = createContext<
  SubscriptionPlanContextType | undefined
>(undefined);

export const SubscriptionPlanProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        console.log("Fetching subscription plans...");
        const data = await authApi.fetchPlans();
        console.log("Fetched Plans:", data);
        if (!Array.isArray(data)) throw new Error("Invalid plan data received");
        setPlans(data);
      } catch (error) {
        console.error("Error fetching plans:", error);
        setPlans([]); // Ensure state is still set
      }
    };
    loadPlans();
  }, []);

  const getPlanById = (id: number) => plans.find((plan) => plan.id === id);

  return (
    <SubscriptionPlanContext.Provider value={{ plans, getPlanById }}>
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
