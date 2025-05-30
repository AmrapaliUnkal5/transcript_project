import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';

export const NoSidebarLayout: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [user, setUser] = useState<{ name: string; avatar: string }>({
    name: "Guest",
    avatar:
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png", // Default avatar
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Function to update user from localStorage
  const updateUserFromLocalStorage = () => {
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser({
          name: parsedUser.name || "Guest",
          avatar:
            parsedUser.avatar_url ||
            "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png",
        });
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  };

  useEffect(() => {
    updateUserFromLocalStorage(); // Load user initially

    // Listen for custom event "userUpdated"
    const handleUserUpdate = () => {
      updateUserFromLocalStorage();
    };
    window.addEventListener("userUpdated", handleUserUpdate);

    return () => {
      window.removeEventListener("userUpdated", handleUserUpdate);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Header user={user} isDark={isDark} toggleTheme={() => setIsDark(!isDark)} />
      <main className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900">
        <Outlet />
      </main>
    </div>
  );
}; 