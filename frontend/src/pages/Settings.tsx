import React, { useState, useEffect } from "react";
import { User, Globe, Bell, Shield, Key, Users, AlertTriangle } from "lucide-react";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";
import { authApi, UserUpdate, subscriptionApi } from "../services/api";
import { formatUiDate } from "../utils/date";
import TeamManagement from "../components/TeamManagement";
import { ToastContainer, toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

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
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [passwordErrors, setPasswordErrors] = useState<{
    [key: string]: string;
  }>({});
  const { updateUser, refreshUserData } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  // New state to track if user is logged in with social provider
  const [isSocialLogin, setIsSocialLogin] = useState(false);

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
    addons: [],
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
            addons: response.addons ?? [],
          }));
          
          // Check if user has a social login provider (Google or Facebook)
          if (response.auth_providers && response.auth_providers.length > 0) {
            const socialProviders = response.auth_providers.filter(
              (provider: string) => provider === "google" || provider === "facebook"
            );
            setIsSocialLogin(socialProviders.length > 0);
          }
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.user_id) return;

      try {
        // const userTeam = await authApi.getUserTeam(user.user_id);
        // console.log("userTeam?.owner_id ", userTeam?.owner_id);
        // if (userTeam?.owner_id && userTeam.owner_id !== user.id)
        if (user?.is_team_member == true) {
          setIsTeamMember(true); // ✅ Mark as a team member
        }
      } catch (error) {
        console.error("Error fetching Team Details:", error);
        // If no team found, this is likely an individual user or team owner
        setIsTeamMember(false);
      }
    };

    checkUserRole();
  }, [user?.user_id]);

  if (!settings) {
    return <p>Loading...</p>;
  }

  useEffect(() => {
  const handleUserUpdate = () => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const parsedUser = JSON.parse(userData);
      setSettings(prev => ({
        ...prev,
        avatar_url: parsedUser.avatar_url || prev.avatar_url
      }));
    }
  };

  window.addEventListener('userUpdated', handleUserUpdate);
  return () => window.removeEventListener('userUpdated', handleUserUpdate);
}, []);

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
      const newAvatarUrl = uploadResponse.resolved_url;
      const savedPath = uploadResponse.url;
      console.log("newAvatarUrl", newAvatarUrl);
      console.log("user?.id", user?.user_id);

      // Update avatar in backend
      await authApi.updateAvatar({
        user_id: user?.user_id, // Use user.id from context
        avatar_url: savedPath,
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
    } else if (name === "name") {
    const words = value.trim().split(/\s+/);

    // Check if any word is longer than 15 characters or has 5+ repeated characters
    const hasInvalidWord = words.some(
      (word) =>
        word.length > 15 || /(.)\1{5,}/.test(word) // 5 or more repeated characters
    );

    if (hasInvalidWord) {
      setErrors((prev) => ({
        ...prev,
        [name]:
          "Each word must be under 15 characters and not contain excessive repeated letters.",
      }));
    } else {
      setSettings((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  } 
    else {
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
          currentAvatarUrl: settings.avatar_url,
        };
        await authApi.updateUserDetails(userUpdateData); // Update user details
        
        // Refresh user data from backend to get the latest information
        await refreshUserData();        
        
        toast.success("Your profile information has been updated successfully!"); // Success toast
      } catch (error) {
        console.error("Error saving changes:", error);
        toast.error("We couldn't save your changes. Please try again."); // Error toast
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

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (!showDeleteModal) {
      setShowDeleteModal(true);
      return;
    }
    
    try {
      setDeleteLoading(true);
      await authApi.deleteAccount();
      // Clear auth data and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?deleted=true';
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setDeleteLoading(false);
      setShowDeleteModal(false);
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
      {!isTeamMember && (
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
      )}
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
                 onError={(e) => {
                  e.currentTarget.onerror = null; // Prevent infinite loop if fallback also fails
                  e.currentTarget.src = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_640.png";
                }}
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
            <h2 className="text-lg font-semibold mb-4 text-black">
              {settings.name || "Unnamed"}
            </h2>
            <p className="text-gray-500 dark:text-gray-400">{settings.email}</p>
          </div>
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-black">
            Profile Information
          </h2>
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
                className={`w-full px-3 py-2 border ${errors.name ? "border-red-500" : "border-gray-300"} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email/User Login
              </label>
              <input
                type="email"
                name="email"
                value={settings.email}
                disabled
                className={`w-full px-3 py-2 border ${errors.email ? "border-red-500" : "border-gray-300"} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
              />
            </div>
            {/* Phone Number */}
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
            {/* Company Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Company Name
              </label>
              <input
                type="text"
                id="company_name"
                name="company_name"
                value={settings.company_name}
                onChange={handleInputChange}
                className={`w-full px-3 py-2 border ${errors.company_name ? "border-red-500" : "border-gray-300"} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
              />
            </div>

            {/* <div>
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
                className={`w-full px-3 py-2 border ${errors.communication_email ? "border-red-500" : "border-gray-300"} rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white`}
              />
              {errors.communication_email && (
                <p className="text-red-500 text-sm mt-1">
                  {errors.communication_email}
                </p>
              )}
            </div> */}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-4 py-2 rounded-md transition-colors ${
                  saving
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#5348CB] hover:bg-[#433aa8] text-white"
                }`}
               >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
        <div className="md:col-span-2 mt-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-black">
              Subscription Details
            </h2>
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
                  {settings.subscription?.plan_name?.toLowerCase() === "explorer"
                    ? "Free"
                    : `${settings.subscription?.amount} ${settings.subscription?.currency}`}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date
                </label>
                <p className="text-gray-900 dark:text-white">
                  {formatUiDate(settings.subscription?.payment_date)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiry Date
                </label>
                <p className="text-gray-900 dark:text-white">
                  {formatUiDate(settings.subscription?.expiry_date)}
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

            {/* Cancel Subscription CTA */}
            {settings.subscription?.status === "active" && settings.subscription?.auto_renew && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={async () => {
                    const confirmed = window.confirm(
                      "You're about to cancel your subscription. From the next billing cycle, your plan will not renew automatically."
                    );
                    if (!confirmed) return;
                    try {
                      setLoading(true);
                      await subscriptionApi.cancelSubscription();
                      toast.success("Auto-renew has been turned off. Your plan will not renew next cycle.");
                      // Refresh user details to reflect auto_renew = false
                      const response = await authApi.getUserDetails();
                      setSettings((prev) => ({
                        ...prev,
                        subscription: {
                          ...prev.subscription,
                          auto_renew: response.subscription?.auto_renew || false,
                          status: response.subscription?.status || prev.subscription.status,
                        },
                      }));
                    } catch (e) {
                      toast.error("Failed to cancel subscription. Please try again.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white"
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        </div>

                <div className="md:col-span-2 mt-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 text-black">
              Active Addons
            </h2>

            {settings.addons && settings.addons.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 divide-y divide-gray-200">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        S.No.
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        Addon Name
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        Status
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        Purchase Date
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        Expiry Date
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        Auto Renew
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600 dark:text-gray-300">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {settings.addons.map((addon: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {index + 1}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {addon.addon_name}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              addon.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {addon.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {formatUiDate(addon.purchase_date)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {formatUiDate(addon.expiry_date)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                          {addon.auto_renew ? "Yes" : "No"}
                        </td>
                        <td className="px-4 py-2 text-sm">
                          {settings.subscription?.status !== "active" || settings.subscription?.auto_renew === false ? (
                            <span className="text-gray-400">—</span>
                          ) : addon.auto_renew ? (
                            <button
                              onClick={async () => {
                                try {
                                  await subscriptionApi.cancelAddon(addon.addon_id || addon.addonId || addon.id);
                                  toast.success("Addon set to cancel at next renewal.");
                                  // Optimistically update UI: mark this addon's auto_renew false
                                  setSettings((prev: any) => ({
                                    ...prev,
                                    addons: prev.addons.map((a: any, i: number) =>
                                      i === index ? { ...a, auto_renew: false, status: a.status } : a
                                    ),
                                  }));
                                } catch (e: any) {
                                  toast.error(e.message || "Failed to schedule addon cancellation");
                                }
                              }}
                              className="px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-md bg-gray-200 text-gray-600 cursor-not-allowed">Cancelled</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">No active addons.</p>
            )}
          </div>
        </div>



        {/* Change Password Section - Only show for non-social login users */}
        {!isSocialLogin && (
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-6">
            <div className="flex items-center mb-4">
              <Key className="w-5 h-5 mr-2 text-gray-500" />
              <h2 className="text-lg font-semibold mb-4 text-black">
                Change Password
              </h2>
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
        )}

        {/* Delete Account Section */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mt-6">
          <div className="flex items-center mb-4">
            <AlertTriangle className="w-5 h-5 mr-2 text-red-500" />
            <h2 className="text-lg font-semibold text-black">Delete Account</h2>
          </div>
          <div className="space-y-4">
            <p className="text-gray-400">
              Deleting your account will permanently remove all your data from our system. This includes your profile information, subscriptions, bots, files, chat messages, and all other associated data. This action cannot be undone.
            </p>
            <div className="flex justify-end">
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white"
              >
                Delete Account
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

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto">
            <h3 className="text-xl font-bold text-red-500 mb-4">Confirm Account Deletion</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              This will permanently delete your account and all associated data:
              <ul className="list-disc pl-6 mt-2">
                <li>User information and subscription</li>
                <li>All chatbots and their settings</li>
                <li>YouTube transcripts and scraped web content</li>
                <li>Uploaded files and documents</li>
                <li>Chat messages and conversation history</li>
                <li>Team members and collaborations</li>
                <li>Analytics, word clouds, and other data</li>
              </ul>
              <strong className="block mt-4 text-red-500">This action cannot be undone.</strong>
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400 text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className={`px-4 py-2 rounded-md transition-colors ${
                  deleteLoading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                {deleteLoading ? "Deleting..." : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {renderTabMenu()}
      {renderTabContent()}
    </div>
  );
};
