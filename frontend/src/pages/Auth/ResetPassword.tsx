import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { authApi } from "../../services/api"; // Assuming API call function exists
import { AxiosError } from "axios";
import { useLoader } from "../../context/LoaderContext";
import Loader from "../../components/Loader";

export const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  //const [loading, setLoading] = useState<boolean>(false);
  const { loading, setLoading } = useLoader(); // Use global loader state

  const token = searchParams.get("token"); // Get token from URL query params
  //const email = searchParams.get("email"); // Get email from URL query params
  console.log("token", token);
  //console.log("email", email);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!password || !confirmPassword) {
      setError("Both fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!token) {
      setError("Token is missing.");
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.resetPassword({
        token: token ?? "",
        password,
      });

      setMessage(response.message || "Password reset successful!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(err.response?.data?.detail || "Something went wrong.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Loader /> {/* Global loader component */}
      <div className="max-w-md w-full bg-white p-6 rounded shadow-md">
        <h2 className="text-2xl font-bold text-center">Reset Password</h2>

        {message ? (
          <p className="text-green-500 text-center">{message}</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                New Password
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border rounded-md"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded mt-4 hover:bg-blue-600"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
