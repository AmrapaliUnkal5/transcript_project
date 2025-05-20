import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Gem } from "lucide-react";

export const PlanSelection = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelect = (plan: string) => {
    setSelectedPlan(plan);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-gray-900 p-6">
      {/* Header */}
      <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-12">
        Choose Your Plan
      </h1>

      {/* Plans Container */}
      <div className="w-full max-w-7xl flex gap-12">
        {/* Explorer Plan (Free Trial) */}
        <div
          className={`flex flex-col justify-between p-10 w-1/2 h-[450px] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 transform hover:scale-105 border-4 ${
            selectedPlan === "explorer"
              ? "border-blue-600"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
          }`}
          onClick={() => {
            handleSelect("explorer");
            navigate("/nosidebar/create-bot");
          }}
        >
          <div className="flex items-center mb-6">
            <CheckCircle className="w-14 h-14 text-blue-600 mr-4" />
            <h2 className="text-4xl font-semibold">Start with Explorer (Free)</h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            🚀 Kickstart your journey with a free trial! Best suited for individuals and small teams.
          </p>
          <ul className="text-lg text-gray-600 dark:text-gray-400">
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
              <span><strong>50,000 words</strong> processing limit</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
              <span><strong>20 MB</strong> storage</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
              <span><strong>1 chatbot</strong> with basic customization</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
              <span>Crawl <strong>1 website</strong></span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-1 flex-shrink-0" />
              <span><strong>100 messages</strong> per month</span>
            </li> 
          </ul>
        </div>

        {/* Paid Subscription Plans */}
        <div
          className={`flex flex-col justify-between p-10 w-1/2 h-[450px] bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 transform hover:scale-105 border-4 ${
            selectedPlan === "subscription"
              ? "border-blue-600"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
          }`}
          onClick={() => {
            handleSelect("subscription");
            navigate("/nosidebar/subscription");
          }}
        >
          <div className="flex items-center mb-6">
            <Gem className="w-14 h-14 text-blue-600 mr-4" />
            <h2 className="text-4xl font-semibold">View Subscription Plans</h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            ✨ Unlock powerful features designed for growing teams and enterprises.
          </p>
          <ul className="text-lg text-gray-600 dark:text-gray-400">
            <li>🔹 <strong>Starter</strong> – For individuals</li>
            <li>🔹 <strong>Growth</strong> – For scaling teams</li>
            <li>🔹 <strong>Professional</strong> – For established businesses</li>
            <li>🔹 <strong>Enterprise</strong> – For large-scale custom needs</li>
            <li>🔹 Includes <strong>Analytics, Priority Support, Multi-Website Deployment</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
};