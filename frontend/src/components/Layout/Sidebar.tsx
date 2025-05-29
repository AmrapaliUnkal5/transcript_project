import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  BarChart2,
  CreditCard,
  Settings,
  LogOut,
  Code,
} from "lucide-react";
import { authApi } from "../../services/api";

const navItems = [
  { path: "upload", icon: "/images/dummy/Customize-bot-knowledge-base.png", label: "Knowledge Base" },
  { path: "chatbot", icon: "/images/dummy/Customize-bot-customize-icon.png", label: "Customize Chatbot" },
  { path: "performance", icon: "/images/dummy/Customize-bot-analyics.png", label: "Analytics" },
  { path: "script-generate", icon: "/images/dummy/Customize-bot-script.png", label: "Script Generate" },
];

export const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hiddenRoutes = [
    "/",
    "/welcome",
    "/settings",
    "/create-bot",
    "/subscription",
    "/Options",
    "/myaccount",
    "/account/add-ons",
  ];

  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }

  const handleLogout = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("subscriptionPlans");
    localStorage.removeItem("addonPlans");
    localStorage.removeItem("userAddons");
    navigate("/login");
  };

  return (
    <aside className="bg-white dark:bg-gray-800 w-64 h-[calc(100vh-4rem)] p-4 border-r border-gray-200 dark:border-gray-700 border">
      <div
        className="flex items-center justify-center mb-8 cursor-pointer hover:opacity-80 transition-opacity "
        onClick={() => navigate("/")}
      >
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white "></h1>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-2 rounded-lg font-[Instrument Sans] text-[16px] font-medium  ${
                isActive
                  ? "bg-[#D5DAFE] text-[#5348CB]"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`
            }
          >
           <img src={item.icon} alt={item.label} className="w-6 h-6 object-contain" />

            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};