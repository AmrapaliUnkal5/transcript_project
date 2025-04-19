import React, { useState, useEffect, useRef } from "react";
import {
  Bell,
  Sun,
  Moon,
  Home,
  CreditCard,
  Settings,
  LogOut,
  HelpCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NotificationDropdown } from "../notifications/NotificationDropdown";

interface HeaderProps {
  user: {
    name: string;
    avatar: string;
  };
  isDark: boolean;
  toggleTheme: () => void;
}

export const Header = ({ isDark, toggleTheme }: HeaderProps) => {
  const { user: authUser } = useAuth(); // Get user and logout from context
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for dropdown

  // Transform the authUser to match your existing user prop structure
  const user = {
    name: authUser?.name || "",
    avatar: authUser?.avatar_url || "default-avatar-url",
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("subscriptionPlans");
    navigate("/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header
      className="bg-white dark:bg-gray-800 h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-700
"
    >
      {/* Left Section: Logo/Image */}
      <div className="flex items-center space-x-4">
        <img
          src="https://cdn.pixabay.com/photo/2017/09/26/13/42/apple-2788662_1280.jpg"
          alt="Logo"
          className="h-10 w-auto"
        />
      </div>

      <div className="flex-1" />
      <div className="flex items-center space-x-4">
        {/* Home Button */}
        {/* <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Home"
        >
          {/* <Home className="w-5 h-5" /> */}

        {/* Home Button */}
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          title="Home"
        >
          Home
        </button>

        {/* <Home color={isDark ? "white" : "black"} className="w-5 h-5" />
        </button>
         {/* Theme Toggle (Sun/Moon) */}
        {/* <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Change Theme"
        >
          {isDark ? <Sun color={isDark ? "white" : "black"} className="w-5 h-5" /> : <Moon color={isDark ? "white" : "black"} className="w-5 h-5" />}
        </button>{/* Help/Doubt Button */}

        <button
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          title="Notifications"
        >
          Our Services
        </button>

        <button
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          title="Notifications"
        >
          Our Plans
        </button>

        <button
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          title="Notifications"
        >
          About Us
        </button>

        {/*<button
          onClick={() => navigate("/report-issue")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Have doubts? Ask here!"
        >
          <HelpCircle color={isDark ? "white" : "black"} className="w-5 h-5" />
        </button>*/}

        <button
          onClick={() => navigate("/report-issue")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
          title="Have doubts? Ask here!"
        >
          Help
        </button>

        {/* Notifications Button */}

        {/*<button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        title="Notifications"
        >
          <Bell color={isDark ? "white" : "black"} className="w-5 h-5" />
        </button>
        {/* Dropdown for Avatar */}
        {/* <button
        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
        title="Notifications">Notifications</button> */}
        <NotificationDropdown />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 focus:outline-none"
          >
            <img
              src={user.avatar}
              alt={user?.name || "User"}
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-white cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {user?.name || "User"}
            </span>
          </button>

          {/* Dropdown Content */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 z-50">
              <button
                onClick={() => {
                  navigate("/subscription");
                  setDropdownOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <CreditCard
                  color={isDark ? "white" : "black"}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Subscription
                </span>
              </button>
              <button
                onClick={() => {
                  navigate("/myaccount");
                  setDropdownOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Settings
                  color={isDark ? "white" : "black"}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  My Account
                </span>
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setDropdownOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogOut
                  color={isDark ? "white" : "black"}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Logout
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
