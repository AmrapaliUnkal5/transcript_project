import React, { useState, useEffect, useRef } from "react";
import { Bell, Sun, Moon, Home, Settings, LogOut, HelpCircle, Contact, Headset } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { NotificationDropdown } from "../notifications/NotificationDropdown";
import { Users, LayoutDashboard,Shield  } from "lucide-react";


interface HeaderProps {
  user: {
    name: string;
    avatar: string;
  };
  isDark: boolean;
  toggleTheme: () => void;
}

export const Header = ({ isDark, toggleTheme }: HeaderProps) => {
  const { user: authUser } = useAuth(); 
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); 
  const VITE_ADMIN_URL = import.meta.env.VITE_ADMIN_URL;


  const user = {
    name: authUser?.name || "",
    avatar: authUser?.avatar_url || "default-avatar-url",
  };



  const formatHeaderName = (fullName: string = "") => {
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 4) {
    const initials = words[0][0].toUpperCase() + " " + words[1][0].toUpperCase();
    const lastName = words[words.length - 1];
    return `${initials} ${lastName}`;
  }
  return fullName;
};
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };


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

  style={{
    background: "linear-gradient(to right, #231D53, #28377B)"
  }}
    >
     
      <div className="flex items-center space-x-4">
        <a 
          onClick={() => navigate("/dashboard/transcript_welcome")} 
          className="cursor-pointer"
        >
          <img
            src="/images/logo.png"
            alt="Logo"
            className="h-8 w-auto"
          />
        </a>
      </div>

      <div className="flex-1" />
      <div className="flex items-center space-x-4">
       
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-lg hover:bg-blue-950 dark:hover:bg-blue-800 text-white"
          title="Home"
          style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "16px" }}
        >
          Home
        </button>

        

       <button
         onClick={() => window.open("/report-issue", "_blank")}
          className="p-2 rounded-lg hover:bg-blue-950 dark:hover:bg-blue-800 text-white"
          style={{fontFamily: "Instrument Sans, sans-serif",
              fontSize: "16px",
             
              color:"FFFFFF"
    
              }}
          title="Have doubts? Ask here!">Help</button>
      
    
        <NotificationDropdown />

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 focus:outline-none"
          >
            <img
              src={user.avatar}
              onError={(e) => {
                  e.currentTarget.onerror = null; // Prevent infinite loop if fallback also fails
                  e.currentTarget.src = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png";
                }}
              alt={user?.name || "User"}
              className="w-8 h-8 rounded-full border border-gray-300 dark:border-white cursor-pointer"
            />
            <span className="p-2 rounded-lg hover:bg-blue-950 dark:hover:bg-blue-950 text-white font-instrument sans ">
              {/* {user?.name || "User"} */}
              {formatHeaderName(user?.name) || "User"}
            </span>
          </button>

          {/* Dropdown Content */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 z-50">
              <button
                onClick={() => {
                  navigate("/dashboard/myaccount");
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
              {authUser?.role === "superadmin" && (
                  <button
                    onClick={() => window.open("/superadmin-login", "_blank")}
                    className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Users
                      color={isDark ? "white" : "black"}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Impersonate
                    </span>
                  </button>
                )}

                {(authUser?.role === "superadmin" || authUser?.role === "admin") && (
  <button
    onClick={() => {
      const url = import.meta.env.VITE_ADMIN_URL || "";
      if (url) {
        window.open(url, "_blank");
      } else {
        console.error("Admin URL not set in environment variables.");
      }
    }}
    className="flex items-center space-x-2 w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700"
  >
    <Shield
      color={isDark ? "white" : "black"}
      className="w-4 h-4"
    />
    <span className="text-sm font-medium text-gray-900 dark:text-white">
      Admin Panel
    </span>
  </button>
)}

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