import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import { useLoader } from "../../context/LoaderContext";
import Loader from "../../components/Loader";
import { useRef } from "react";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token"); // Extract the token from URL
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { loading, setLoading } = useLoader(); // Use global loading state
  const navigate = useNavigate();
  const [showResendButton, setShowResendButton] = useState(false);
  const hasRun = useRef(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token || hasRun.current) return;
      hasRun.current = true; // Prevents duplicate calls

      console.log("🔵 Sending request to API with token:", token);

      try {
        setLoading(true);
        const response = await authApi.getEmailVerify(token);
        console.log("API response:", response);
        console.log(response.message);
        setMessage(response.message);
        // Redirect user to login page after success
        setTimeout(() => navigate("/login"), 5000);
      } catch (err) {
        console.log("⚠️ Full error object:", err);

        setLoading(false); // Ensure loading stops on error

        if (err.response) {
          // Axios response error
          console.log("⚠️ Axios Response Error:", err.response);
          setError(err.response.data?.detail || "Email verification failed.");
          if (
            err.response.status === 400 &&
            err.response.data?.detail === "Invalid or expired token"
          ) {
            setShowResendButton(true); // Show resend button if link expired
          } else if (err.request) {
            // Request was made but no response received
            console.log("⚠️ No response from server:", err.request);
            setError("Server did not respond. Please try again later.");
          } else {
            // Other unknown errors
            console.log("⚠️ Unknown Error:", err.message);
            setError("An unexpected error occurred.");
          }
        }
      } finally {
        setLoading(false);
      }
    };

    verifyEmail();
  }, [token, navigate, setLoading]); // **Fixed dependencies**

  // Handle Resend Email API Call
  const handleResendVerification = async () => {
    console.log("token", token);
    if (!token) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const response = await authApi.resendVerificationEmail(token); // Use authApi // Send the token to generate a new email
      setMessage(response.message);
      setShowResendButton(false); // Hide the button after resending
    } catch (err) {
      setError("Failed to resend verification email. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        textAlign: "center",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        backgroundColor: "#f9f9f9",
      }}
    >
      {loading && <Loader />}
      <h2
        style={{
          opacity: 0,
          animation: "fadeIn 1.5s forwards",
          fontSize: "24px",
          color: "#333",
        }}
      >
        Email Verification
      </h2>

      {loading && (
        <p
          style={{
            fontSize: "18px",
            fontWeight: "bold",
            color: "#555",
            animation: "blink 1s infinite alternate",
          }}
        >
          Verifying your email...
        </p>
      )}

      {!loading && message && (
        <p
          style={{
            color: "green",
            fontSize: "16px",
            fontWeight: "bold",
            opacity: 0,
            animation: "fadeIn 1s forwards",
            padding: "10px",
            border: "1px solid green",
            borderRadius: "5px",
            backgroundColor: "#e6ffe6",
          }}
        >
          {message}
        </p>
      )}

      {!loading && error && (
        <p
          style={{
            color: "red",
            fontSize: "16px",
            fontWeight: "bold",
            opacity: 0,
            animation: "fadeIn 1s forwards",
            padding: "10px",
            border: "1px solid red",
            borderRadius: "5px",
            backgroundColor: "#ffe6e6",
          }}
        >
          {error}
        </p>
      )}
      {/* Show Resend Button if the link is expired */}
      {showResendButton && (
        <button
          onClick={handleResendVerification}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
            marginTop: "15px",
          }}
        >
          Resend Verification Email
        </button>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
  
          @keyframes blink {
            from { opacity: 0.5; }
            to { opacity: 1; }
          }
        `}
      </style>
    </div>
  );
};

export default VerifyEmail;
