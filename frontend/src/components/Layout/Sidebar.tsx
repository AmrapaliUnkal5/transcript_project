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
} from "lucide-react";
import { authApi } from "../../services/api";

const navItems = [
  { path: "/chatbot", icon: MessageSquare, label: "Chatbot Customization" },
  { path: "/upload", icon: Upload, label: "Knowledge Base" },
  { path: "/performance", icon: BarChart2, label: "Analytics" },
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
  ];

  if (hiddenRoutes.includes(location.pathname)) {
    return null;
  }

  const handleLogout = async () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <aside className="bg-white dark:bg-gray-800 w-64 h-[calc(100vh-4rem)] mt-16 p-4 border-r border-gray-200 dark:border-gray-700">
      <div
        className="flex items-center justify-center mb-8 cursor-pointer hover:opacity-80 transition-opacity"
        onClick={() => navigate("/")}
      >
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          
        </h1>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-blue-500 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
