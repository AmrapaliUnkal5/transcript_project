import React, { useState, useEffect } from "react";
import { User, Globe, Bell, Shield, Key, Users } from "lucide-react";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";
import { authApi, UserUpdate } from "../services/api";
import TeamManagement from "../components/TeamManagement";
import { ToastContainer, toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";

export const Settings = () => {
  // Retrieve user data from localStorage
  const { loading, setLoading } = useLoader(); // Use global loader
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  const [activeTab, setActiveTab] = useState("profile"); // Added activeTab state
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    [key: string]: string;
  }>({});
  const { updateUser } = useAuth();

  const [settings, setSettings] = useState({
    name: "",
    email: "",
    company_name: "",
    communication_email: "",
    phone_no: "",
    avatar_url:
      user?.avatar_url ||
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png",
    subscription: {
      plan_name: "",
      amount: null,
      currency: "", // or "" if you prefer empty string
      payment_date: "",
      expiry_date: "",
      auto_renew: false,
      status: "",
    },
  });

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const response = await authApi.getUserDetails(); // Fetch user details
        if (response) {
          console.log("response", response);
          setSettings((prev) => ({
            ...prev, // Keep previous values
            name: response.name || "",
            email: response.email || "",
            company_name: response.company_name || "",
            communication_email: response.communication_email || "",
            phone_no: response.phone_no || "",
            avatar_url:
              user?.avatar_url ||
              "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png",
            subscription: {
              plan_name: response.subscription?.plan_name || "Free Plan",
              amount: response.subscription?.amount || 0,
              currency: response.subscription?.currency || "",
              payment_date: response.subscription?.payment_date || null,
              expiry_date: response.subscription?.expiry_date || null,
              auto_renew: response.subscription?.auto_renew || false,
              status: response.subscription?.status || "active",
            },
          }));
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  if (!settings) {
    return <p>Loading...</p>;
  }

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // Check if the file size is greater than 1MB
      if (file.size > 1024 * 1024) {
        console.log("Original file size:", file.size);
        const compressedFile = await compressImage(file);
        console.log("Compressed file size:", compressedFile.size);
        file = compressedFile;
      }

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
      updateUser(updatedUser); // Update AuthContext state
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

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                reject(new Error("Failed to compress image"));
              }
            },
            "image/jpeg",
            0.7
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "phone_no") {
      if (/^\d*$/.test(value)) {
        setSettings((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: "" })); // Clear error
      } else {
        setErrors((prev) => ({ ...prev, [name]: "Only numbers are allowed" }));
      }
    } else if (name === "communication_email") {
      setSettings((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: "" })); // Clear error on typing
    } else {
      setSettings((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const emailRegex = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

    if (
      settings.communication_email &&
      !emailRegex.test(settings.communication_email)
    ) {
      newErrors.communication_email = "Invalid email address";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0; // Returns true if no errors
  };

  // Handle save button click
  const handleSave = async () => {
    if (validateForm()) {
      setSaving(true);
      setLoading(true);
      try {
        const userUpdateData: UserUpdate = {
          name: settings.name,
          company_name: settings.company_name,
          communication_email: settings.communication_email,
          phone_no: settings.phone_no,
        };
        //console.log("userUpdateData", userUpdateData);
        await authApi.updateUserDetails(userUpdateData); // Update user details
        // Update the user in context and localStorage
        updateUser({
          name: settings.name,
          company_name: settings.company_name,
          phone_no: settings.phone_no,
        });
        toast.success("Changes saved successfully!"); // Success toast
        //alert("Changes saved successfully");
      } catch (error) {
        console.error("Error saving changes:", error);
        toast.error("Failed to save changes. Please try again."); // Error toast
      } finally {
        setSaving(false);
        setLoading(false);
      }
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    setPasswordErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validatePasswordForm = () => {
    let newErrors: { [key: string]: string } = {};

    if (!passwordData.current_password) {
      newErrors.current_password = "Current password is required";
    }

    if (!passwordData.new_password) {
      newErrors.new_password = "New password is required";
    } else if (passwordData.new_password.length < 8) {
      newErrors.new_password = "Password must be at least 8 characters";
    }

    if (!passwordData.confirm_password) {
      newErrors.confirm_password = "Please confirm your new password";
    } else if (passwordData.new_password !== passwordData.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }

    setPasswordErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdatePassword = async () => {
    if (validatePasswordForm()) {
      setChangingPassword(true);
      setLoading(true);
      try {
        await authApi.changePassword({
          current_password: passwordData.current_password,
          new_password: passwordData.new_password,
        });
        toast.success("Password updated successfully!");
        // Reset form
        setPasswordData({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
      } catch (error) {
        console.error("Error updating password:", error);
        toast.error(
          "Failed to update password. Please check your current password."
        );
        setPasswordErrors({
          current_password: "Current password may be incorrect",
        });
      } finally {
        setChangingPassword(false);
        setLoading(false);
      }
    }
  };

  // Added tab menu component
  const renderTabMenu = () => (
    <div className="flex border-b mb-6">
      <button
        className={`px-4 py-2 ${
          activeTab === "profile"
            ? "border-b-2 border-blue-500 text-blue-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
        onClick={() => setActiveTab("profile")}
      >
        <div className="flex items-center">
          <User className="w-4 h-4 mr-2" />
          Profile
        </div>
      </button>
      <button
        className={`px-4 py-2 ${
          activeTab === "team"
            ? "border-b-2 border-blue-500 text-blue-600"
            : "text-gray-500 hover:text-gray-700"
        }`}
        onClick={() => setActiveTab("team")}
      >
        <div className="flex items-center">
          <Users className="w-4 h-4 mr-2" />
          Team
        </div>
      </button>
    </div>
  );

  // Render appropriate content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case "team":
        return <TeamManagement />;
      case "profile":
      default:
        return renderProfileContent();
    }
  };

  // Profile tab content
  const renderProfileContent = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex flex-col items-center space-y-4">
            <div className="relative w-32 h-32">
              {/* Avatar Image */}
              <img
                src={settings.avatar_url}
                alt="Avatar"
                className="object-cover w-full h-full rounded-full border-2 border-gray-300 shadow-md"
              />

              {/* Upload Icon Positioned Over Avatar */}
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-2 right-2 bg-blue-600 text-white rounded-full p-2 cursor-pointer shadow-lg border-2 border-white hover:bg-blue-700 transition"
                title="Upload Photo"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <h2 className="text-xl font-semibold">
              {settings.name || "Unnamed"}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">{settings.email}</p>
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={settings.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="company_name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Company Name
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={settings.company_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="communication_email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Communication Email
              </label>
              <input
                type="email"
                id="communication_email"
                name="communication_email"
                value={settings.communication_email}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border ${
                  errors.communication_email
                    ? "border-red-500"
                    : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
              />
              {errors.communication_email && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.communication_email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="phone_no"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Phone Number
              </label>
              <input
                type="text"
                id="phone_no"
                name="phone_no"
                value={settings.phone_no}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border ${
                  errors.phone_no ? "border-red-500" : "border-gray-300"
                } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
              />
              {errors.phone_no && (
                <p className="text-red-500 text-sm mt-1">{errors.phone_no}</p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 rounded-md transition-colors ${
                  saving
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
        <div className="md:col-span-2 mt-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Subscription Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Plan Name
                </label>
                <p className="text-gray-900 dark:text-white">
                  {settings.subscription?.plan_name || "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <p className="text-gray-900 dark:text-white">
                  {settings.subscription?.amount
                    ? `${settings.subscription.amount} ${settings.subscription.currency}`
                    : "Free"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date
                </label>
                <p className="text-gray-900 dark:text-white">
                  {settings.subscription?.payment_date
                    ? new Date(
                        settings.subscription.payment_date
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Date
                </label>
                <p className="text-gray-900 dark:text-white">
                  {settings.subscription?.expiry_date
                    ? new Date(
                        settings.subscription.expiry_date
                      ).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto Renew
                </label>
                <p className="text-gray-900 dark:text-white">
                  {settings.subscription?.auto_renew ? "Yes" : "No"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <p
                  className={`inline-block px-2 py-1 rounded-full text-sm font-medium ${
                    settings.subscription?.status === "active"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                  }`}
                >
                  {settings.subscription?.status || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-6">
          <div className="flex items-center mb-4">
            <Key className="w-5 h-5 mr-2 text-gray-500" />
            <h2 className="text-lg font-semibold">Change Password</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="current_password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Current Password
              </label>
              <div className="relative w-full">
                <input
                  type={showPassword.current ? "text" : "password"}
                  id="current_password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  className={`w-full px-3 py-2 border ${
                    passwordErrors.current_password
                      ? "border-red-500"
                      : "border-gray-300"
                  } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
                />
                {/* Eye icon toggle */}
                <div
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      current: !prev.current,
                    }))
                  }
                >
                  {showPassword.current ? (
                    <Eye className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                  )}
                </div>
              </div>
              {passwordErrors.current_password && (
                <p className="text-red-500 text-sm mt-1">
                  {passwordErrors.current_password}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="new_password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                New Password
              </label>
              <div className="relative w-full">
                <input
                  type={showPassword.new ? "text" : "password"}
                  id="new_password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  className={`w-full px-3 py-2 border ${
                    passwordErrors.new_password
                      ? "border-red-500"
                      : "border-gray-300"
                  } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
                />
                {/* Eye icon toggle */}
                <div
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, new: !prev.new }))
                  }
                >
                  {showPassword.new ? (
                    <Eye className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                  )}
                </div>
              </div>
              {passwordErrors.new_password && (
                <p className="text-red-500 text-sm mt-1">
                  {passwordErrors.new_password}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="confirm_password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Confirm New Password
              </label>
              <div className="relative w-full">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  id="confirm_password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  className={`w-full px-3 py-2 border ${
                    passwordErrors.confirm_password
                      ? "border-red-500"
                      : "border-gray-300"
                  } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
                />
                {/* Eye icon toggle */}
                <div
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer"
                  onClick={() =>
                    setShowPassword((prev) => ({
                      ...prev,
                      confirm: !prev.confirm,
                    }))
                  }
                >
                  {showPassword.confirm ? (
                    <Eye className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                  )}
                </div>
              </div>
              {passwordErrors.confirm_password && (
                <p className="text-red-500 text-sm mt-1">
                  {passwordErrors.confirm_password}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleUpdatePassword}
                disabled={changingPassword}
                className={`px-4 py-2 rounded-md transition-colors ${
                  changingPassword
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {loading && <Loader />}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Account Settings
      </h1>
      <ToastContainer position="top-right" autoClose={3000} />

      {renderTabMenu()}
      {renderTabContent()}
    </div>
  );
};
