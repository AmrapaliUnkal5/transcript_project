import React from "react";
import { useNavigate } from "react-router-dom";

export const AdminWelcome = () => {
  const navigate = useNavigate();

  const handleGoToDashboard = () => {
    navigate("/admin/dashboard"); // Replace with your actual route
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full bg-white p-10 rounded-lg shadow-md text-center">
        <h1 className="text-4xl font-bold text-blue-800 mb-4">Welcome, Admin!</h1>
        <p className="text-gray-700 text-lg mb-6">
          You have successfully logged in to the admin panel. From here, you can manage users, view reports,
          and configure system settings.
        </p>
        <button
          onClick={handleGoToDashboard}
          className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors duration-200"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};
