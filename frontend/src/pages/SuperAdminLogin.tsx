import { useNavigate } from "react-router-dom";
import React, {  useState, useEffect  } from "react";
import { authApi } from "../services/api";
import { useAuth } from "../context/AuthContext";

export const SuperAdminLogin = () => {
  const [customerEmail, setCustomerEmail] = useState("");
  const [customers, setCustomers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await authApi.getAllCustomers(); // <-- you'll need to implement this API
        setCustomers(res || []);
      } catch (err) {
        console.error("Failed to fetch customers", err);
      }
    };
    fetchCustomers();
  }, []);
  

  const handleImpersonate = async () => {
    setError("");

    try {
      // Call new impersonation API with just customer email
      const res = await authApi.impersonate({
        customer_email: customerEmail,
      });

      // Store token & user in context
      login(res.access_token, res.user);

      // Redirect to dashboard
      navigate("/dashboard/transcript_welcome?impersonated=true");
    } catch (err) {
      console.error(err);
      setError("Impersonation failed.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 border rounded">
      <h2 className="text-xl font-bold mb-4">SuperAdmin Impersonation</h2>

      <select
        value={customerEmail}
        onChange={(e) => setCustomerEmail(e.target.value)}
        className="w-full mb-4 p-2 border rounded"
      >
        <option value="">Select Customer</option>
        {customers.map((email, idx) => (
          <option key={idx} value={email}>
            {email}
          </option>
        ))}
      </select>

      <button
        onClick={handleImpersonate}
        className="w-full bg-blue-600 text-white py-2 rounded"
        disabled={!customerEmail}
      >
        Impersonate
      </button>

      {error && <p className="text-red-500 mt-4">{error}</p>}
    </div>
  );
};

export default SuperAdminLogin;