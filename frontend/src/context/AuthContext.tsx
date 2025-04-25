import React, { createContext, useContext, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi } from "../services/api";

// Define a specific user type
interface User {
  email: string;
  role: string;
  company_name: string;
  name: string;
  user_id: number;
  avatar_url?: string;
  phone_no?: string;
  subscription_plan_id?: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  botId: number | null;
  getBotId: (id: number | null) => void;
  login: (token: string, userData: User) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null); // Change default to `null`
  const [user, setUser] = useState<User | null>(null);
  const [botId, getBotId] = useState<number | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  console.log("isAuthenticated", isAuthenticated);
  
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));
    }
  };

  const refreshUserData = async () => {
    try {
      if (user && user.email) {
        const response = await authApi.getAccountInfo(user.email);
        if (response && response.user) {
          const updatedUserData = response.user;
          setUser(updatedUserData);
          localStorage.setItem("user", JSON.stringify(updatedUserData));
        }
      }
    } catch (error) {
      console.error("Error refreshing user data:", error);
      throw error;
    }
  };
  
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (token && userData) {
      try {
        const parsedUserData = JSON.parse(userData);
        console.log(parsedUserData);
        setIsAuthenticated(true);
        setUser(parsedUserData);
        //subscription context load
      } catch (error) {
        console.error("Error parsing user data:", error);
        setIsAuthenticated(false);
        setUser(null);
      }
    } else {
      setIsAuthenticated(false);
      setUser(null);

      // Only redirect if the user is not already on the signup or login page
      if (
        ![
          "/signup",
          "/login",
          "/forgot-password",
          "/reset-password",
          "/home",
          "/verify-email",
          "/demo",
          "/faq",
          "/privacy_policy",
          "/terms",
          "/customersupport",
        ].includes(location.pathname)
      ) {
        navigate("/login");
      }
    }
  }, [navigate, location.pathname]);

  if (isAuthenticated === null) {
    return <div>Loading...</div>; // Prevents redirect while checking localStorage
  }

  const login = (token: string, userData: User) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("subscriptionPlans");
    setIsAuthenticated(false);
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        botId,
        getBotId,
        login,
        logout,
        updateUser,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};