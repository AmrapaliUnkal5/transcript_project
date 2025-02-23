import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Welcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-2xl mx-auto">
        <div className="mb-8 flex justify-center">
          <div className="p-4 bg-blue-500 rounded-full">
            <Bot className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Welcome to ChatBot Builder, {user?.name}!
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Let's create your first intelligent chatbot that will help your customers 24/7.
        </p>
        <button
          onClick={() => navigate('/create-bot')}
          className="inline-flex items-center px-6 py-3 text-lg font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Build Your First Bot
          <ArrowRight className="ml-2 w-5 h-5" />
        </button>
      </div>
    </div>
  );
};