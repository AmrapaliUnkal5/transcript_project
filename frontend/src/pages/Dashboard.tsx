import React from 'react';
import { BarChart2, MessageSquare, Star, Clock } from 'lucide-react';
import type { ChatMetrics } from '../types';

export const Dashboard = () => {
  const metrics: ChatMetrics = {
    totalConversations: 1234,
    averageRating: 4.8,
    responseTime: 2.5,
    userSatisfaction: 95,
  };

  const cards = [
    {
      title: 'Total Conversations',
      value: metrics.totalConversations.toLocaleString(),
      icon: MessageSquare,
      color: 'bg-blue-500',
    },
    {
      title: 'Average Rating',
      value: metrics.averageRating.toFixed(1),
      icon: Star,
      color: 'bg-yellow-500',
    },
    {
      title: 'Response Time',
      value: `${metrics.responseTime}s`,
      icon: Clock,
      color: 'bg-green-500',
    },
    {
      title: 'User Satisfaction',
      value: `${metrics.userSatisfaction}%`,
      icon: BarChart2,
      color: 'bg-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 transition-transform hover:scale-105"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {card.value}
              </span>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {card.title}
            </h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    New conversation started
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {i} hour{i !== 1 ? 's' : ''} ago
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { title: 'Customize Bot', icon: MessageSquare },
              { title: 'Upload Files', icon: BarChart2 },
              { title: 'View Reports', icon: Star },
              { title: 'Settings', icon: Clock },
            ].map((action) => (
              <button
                key={action.title}
                className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <action.icon className="w-6 h-6 mb-2 text-blue-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {action.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};