import React, { useState, useEffect, useRef } from "react";
import { Bell, Globe, Sun, Moon, Home, CreditCard, Settings, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeaderProps {
  user: {
    name: string;
    avatar: string;
  };
  isDark: boolean;
  toggleTheme: () => void;
}

export const Header = ({ user, isDark, toggleTheme }: HeaderProps) => {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for dropdown

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white dark:bg-gray-800 h-16 px-6 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
      <div className="flex-1" />
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Home className="w-5 h-5" />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <Globe className="w-5 h-5" />
        </button>
        <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="w-5 h-5" />
        </button>

        {/* Dropdown for Avatar */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 focus:outline-none"
          >
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full cursor-pointer"
            />
            <span className="text-sm font-medium">{user.name}</span>
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
                <CreditCard className="w-4 h-4" />
                <span>Subscription</span>
              </button>
              <button
                onClick={() => {
                  navigate("/myaccount");
                  setDropdownOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Settings className="w-4 h-4" />
                <span>My Account</span>
              </button>
              <button
                onClick={() => {
                  handleLogout();
                  setDropdownOpen(false);
                }}
                className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
