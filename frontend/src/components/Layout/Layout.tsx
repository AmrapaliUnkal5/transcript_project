import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export const Layout = () => {
  const [isDark, setIsDark] = React.useState(false);
  const [user, setUser] = useState<{ name: string; avatar: string }>({
    name: "Guest",
    avatar:
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png", // Default avatar
  });

  React.useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  // Function to update user from localStorage
  const updateUserFromLocalStorage = () => {
    //console.log("Fetching user data");
    // Fetch user data from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        //console.log("parsed user", parsedUser);
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
      //console.log("handleuserupdate");
      updateUserFromLocalStorage();
    };
    //console.log("userUpdated");
    window.addEventListener("userUpdated", handleUserUpdate);

    return () => {
      window.removeEventListener("userUpdated", handleUserUpdate);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          user={user}
          isDark={isDark}
          toggleTheme={() => setIsDark(!isDark)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-gray-900 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
