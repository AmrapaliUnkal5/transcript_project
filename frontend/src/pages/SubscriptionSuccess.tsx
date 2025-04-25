import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircle } from 'lucide-react';

export const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { refreshUserData } = useAuth();

  useEffect(() => {
    const handleSuccessfulSubscription = async () => {
      try {
        // Refresh user data to get updated subscription information
        await refreshUserData();
        
        // Show success page briefly before redirecting
        setTimeout(() => {
          navigate('/dashboard');
        }, 3000);
      } catch (error) {
        console.error('Error handling subscription success:', error);
      }
    };

    handleSuccessfulSubscription();
  }, [navigate, refreshUserData]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 max-w-md w-full text-center">
        <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Subscription Successful!
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your subscription has been processed successfully. You'll be redirected to your dashboard in a moment.
        </p>
        <div className="flex justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}; 