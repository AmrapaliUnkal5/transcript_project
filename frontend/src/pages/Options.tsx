import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Crown, Star, Gem } from "lucide-react";

const PlanSelection = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);


  const handleSelect = (plan: string) => {
    setSelectedPlan(plan);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] p-6">
      {/* Header */}
      <h1 className="text-5xl font-bold text-gray-900 mb-12">
        Choose Your Option
      </h1>

      {/* Plans Container */}
      <div className="w-full max-w-7xl flex gap-12">
        {/* Free Plan */}
        <div
          className={`flex flex-col justify-between p-10 w-1/2 h-[450px] bg-white text-gray-800 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 transform hover:scale-105 border-4 ${
            selectedPlan === "free" ? "border-blue-600" : "border-gray-300 hover:border-blue-500"
          }`}
          onClick={() => {
            handleSelect("free");
            navigate("/create-bot");
          }}
        >
          <div className="flex items-center mb-6">
            <CheckCircle className="w-14 h-14 text-blue-600 mr-4" />
            <h2 className="text-4xl font-semibold">Go For Free Trial</h2>
          </div>
          <p className="text-lg text-gray-600 leading-relaxed">
            🚀 Get started for free! Ideal for beginners and small projects.
          </p>
          <ul className="text-lg text-gray-600">
            <li>✅ Supports up to <strong>10 Root Nodes</strong></li>
            <li>✅ Upload file size limit: <strong>50 MB</strong></li>
            <li>🔹 <strong>No credit card required</strong></li>
            <li>🔹 <strong>Instant setup, start building now!</strong></li>
          </ul>
        </div>

        {/* Subscription Plan */}
        <div
          className={`flex flex-col justify-between p-10 w-1/2 h-[450px] bg-white text-gray-800 rounded-2xl shadow-xl cursor-pointer transition-all duration-300 transform hover:scale-105 border-4 ${
            selectedPlan === "subscription" ? "border-blue-600" : "border-gray-300 hover:border-blue-500"
          }`}
          onClick={() => {
            handleSelect("subscription");
            navigate("/subscription");
          }}
        >
          <div className="flex items-center mb-6">
            <Gem className="w-14 h-14 text-blue-600 mr-4" />
            <h2 className="text-4xl font-semibold">View Subscription Plans</h2>
          </div>
          <p className="text-lg text-gray-600 leading-relaxed">
            🏆 Unlock premium features for advanced users and businesses.
          </p>
          <ul className="text-lg text-gray-600">
            <li>🔹 <strong>Basic</strong> – Ideal for individuals</li>
            <li>🔹 <strong>Professional</strong> – Perfect for growing teams</li>
            <li>🔹 <strong>Enterprise</strong> – Full-scale solutions</li>
            <li>🔹 Includes <strong>priority support & analytics</strong></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
