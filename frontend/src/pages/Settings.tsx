import React, { useState } from "react";
import { User, Globe, Bell, Shield, Key } from "lucide-react";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";

import { authApi } from "../services/api";

export const Settings = () => {
  // Retrieve user data from localStorage
  const { loading, setLoading } = useLoader(); // Use global loader

  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;

  const [settings, setSettings] = useState({
    name: user?.name || "",
    email: user?.email || "",
    company_name: user?.company_name || "",
    phone_no: user?.phone_no || "",
    notifications: {
      email: true,
      push: false,
      desktop: true,
    },
    language: "en",
    theme: "system",
    twoFactor: false,
    avatar_url:
      user?.avatar_url ||
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png",
  });

  //const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // Upload avatar
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await authApi.uploadAvatar(formData);
      const newAvatarUrl = uploadResponse.url;
      console.log("newAvatarUrl", newAvatarUrl);
      console.log("user?.id", user?.user_id);

      // Update avatar in backend
      await authApi.updateAvatar({
        user_id: user?.user_id, // Use user.id from context
        avatar_url: newAvatarUrl,
      });

      // Update localStorage and AuthContext
      const updatedUser = { ...user, avatar_url: newAvatarUrl };
      //setUser(updatedUser); // Update AuthContext state
      localStorage.setItem("user", JSON.stringify(updatedUser)); // Update localStorage
      setSettings((prev) => ({
        ...prev,
        avatar_url: newAvatarUrl,
      }));
      console.log(localStorage.getItem("user"));
      window.dispatchEvent(new Event("userUpdated"));

      setMessage("Avatar updated successfully!");
    } catch (error) {
      console.error("Error updating avatar:", error);
      setError("Failed to update avatar. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleNotificationChange = (
    type: keyof typeof settings.notifications
  ) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [type]: !prev.notifications[type],
      },
    }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Settings
      </h1>

      {/* Profile Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <User className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profile Settings
          </h2>
        </div>
        {/* Display Loader while loading */}
        {loading && <Loader />}
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <img
              src={settings.avatar_url}
              alt="Profile"
              className="w-16 h-16 rounded-full"
            />
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              Change Photo
            </button>
            <input
              id="fileInput"
              style={{ display: "none" }} // Hide the input field
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
            />
            {loading && <p>Uploading...</p>}
            {error && <p style={{ color: "red" }}>{error}</p>}
            {message && <p style={{ color: "green" }}>{message}</p>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={settings.name}
                onChange={handleInputChange}
                disabled
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={settings.email}
                disabled
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Phone Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={settings.phone_no || ""}
                disabled
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                value={settings.company_name || ""}
                disabled
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Bell className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Notification Settings
          </h2>
        </div>
        <div className="space-y-4">
          {Object.entries(settings.notifications).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {key.charAt(0).toUpperCase() + key.slice(1)} Notifications
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Receive notifications via {key}
                </p>
              </div>
              <button
                onClick={() =>
                  handleNotificationChange(
                    key as keyof typeof settings.notifications
                  )
                }
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  value ? "bg-blue-500" : "bg-gray-200 dark:bg-gray-700"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    value ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Language and Region */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Globe className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Language and Region
          </h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Language
            </label>
            <select
              value={settings.language}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, language: e.target.value }))
              }
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Time Zone
            </label>
            <select className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500">
              <option>UTC-8 (Pacific Time)</option>
              <option>UTC-5 (Eastern Time)</option>
              <option>UTC+0 (GMT)</option>
              <option>UTC+1 (Central European Time)</option>
            </select>
          </div>
        </div>{" "}
      </div>

      {/* Security Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Shield className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Security
          </h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Two-Factor Authentication
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Add an extra layer of security to your account
              </p>
            </div>
            <button
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  twoFactor: !prev.twoFactor,
                }))
              }
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.twoFactor
                  ? "bg-blue-500"
                  : "bg-gray-200 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.twoFactor ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <div>
            <button className="flex items-center text-blue-500 hover:text-blue-600">
              <Key className="w-4 h-4 mr-2" />
              <span>Change Password</span>
            </button>
          </div>
        </div>
      </div>

      {/* Save Changes */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          Save Changes
        </button>
      </div>
    </div>
  );
};
