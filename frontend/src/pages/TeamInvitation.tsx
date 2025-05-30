import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { authApi } from "../services/api";


export const TeamInvitation = () => {
  const { invitation_token } = useParams<{ invitation_token: string }>();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [status, setStatus] = useState<
    "idle" | "loading" | "error" | "success"
  >("idle");

  useEffect(() => {
    if (!invitation_token) {
      setStatus("error");
    }
  }, [invitation_token]);

  const handleResponse = async (response: "accepted" | "declined") => {
    if (!invitation_token) return;

    setStatus("loading");

    try {
      await authApi.respondToInvitation(invitation_token, response);
      setStatus("success");
      setTimeout(() => {
        navigate("/login"); // or '/teams'
      }, 2000);
    } catch (error: any) {
        console.error(error);
        const backendMessage = error?.response?.data?.detail || "Failed to process invitation. Please try again.";
        setErrorMessage(backendMessage);
        setStatus("error");
      }
  };

  if (!invitation_token) {
    return (
      <div className="text-center mt-10 text-red-500">
        Invalid invitation link.
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white p-6 rounded shadow-md">
        {status === "idle" && (
          <>
            <h1 className="text-2xl font-bold text-center mb-6">
              You've been invited to join a team!
            </h1>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => handleResponse("accepted")}
                className="px-6 py-2 bg-transparent text-blue-500 border border-blue-500 rounded-lg hover:bg-blue-100"
              >
                Accept
              </button>
              <button
                onClick={() => handleResponse("declined")}
                className="px-6 py-2 bg-transparent text-red-500 border border-red-500 rounded-lg hover:bg-red-100"
              >
                Decline
              </button>
            </div>
          </>
        )}

        {status === "loading" && (
          <div className="text-center text-gray-600">
            Processing your response...
          </div>
        )}

        {status === "success" && (
          <div className="text-center text-green-600">
            Response recorded! Redirecting...
          </div>
        )}

        {status === "error" && errorMessage && (
      <div className="text-center text-red-500">
        {errorMessage}
      </div>
      )}
      </div>
    </div>
  );
};

export default TeamInvitation;
