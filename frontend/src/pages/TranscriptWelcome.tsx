import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export const TranscriptWelcome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b to-white dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-8">
          <h1
            className="text-3xl font-bold text-gray-900 dark:text-white mb-2"
            style={{ fontFamily: "Instrument Sans, sans-serif" }}
          >
            Welcome, {user?.name}!
          </h1>
          <p
            className="text-gray-600 dark:text-gray-300 mb-6"
            style={{ fontFamily: "Instrument Sans, sans-serif" }}
          >
            Transcript Project — get started by creating or opening a patient record to upload or record audio for transcription and summary.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/dashboard/transcript/new")}
              className="w-full px-5 py-4 bg-[#39489D] text-white rounded-lg hover:opacity-90 transition"
              style={{ fontFamily: "Instrument Sans, sans-serif" }}
            >
              Start New Patient Record
            </button>
            <button
              onClick={() => navigate("/dashboard/transcript")}
              className="w-full px-5 py-4 bg-[#39489D] text-white rounded-lg hover:opacity-90 transition"
              style={{ fontFamily: "Instrument Sans, sans-serif" }}
            >
              View Recent Records
            </button>
            <button
              onClick={() => navigate("/dashboard/transcript/lookup")}
              className="w-full px-5 py-4 bg-[#39489D] text-white rounded-lg hover:opacity-90 transition"
              style={{ fontFamily: "Instrument Sans, sans-serif" }}
            >
              Patient Lookup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptWelcome;

