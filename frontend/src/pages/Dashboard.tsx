import { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // Import Link from react-router-dom
import { BarChart2, MessageSquare, Star, Clock } from "lucide-react";
import type { ChatMetrics } from "../types";
import { authApi } from "../services/api";

export const Dashboard = () => {
  const [metrics, setMetrics] = useState<ChatMetrics>({
    totalConversations: 0,
    averageRating: 0, // Placeholder
    responseTime: 0, // Placeholder
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await authApi.getBotConversations(); // Fetch bot data

        // Ensure we have at least one bot
        const firstBot = data.length > 0 ? data[0] : null;

        setMetrics({
          totalConversations: firstBot
            ? firstBot["Total Conversation"] ?? 0
            : 0,
          averageRating: firstBot ? firstBot.rating ?? 0 : 0,
          responseTime: firstBot ? firstBot.responsetie ?? 0 : 0,
        });
      } catch (error) {
        console.error("Error fetching bot conversations:", error);
        setMetrics({
          totalConversations: 0,
          averageRating: 0,
          responseTime: 0,
        });
      }
    };

    fetchData();
  }, []);

  const cards = [
    {
      title: "Total Conversations",
      value: metrics.totalConversations.toLocaleString(),
      icon: MessageSquare,
      color: "bg-blue-500",
    },
    {
      title: "Average Rating",
      value: metrics.averageRating.toFixed(1),
      icon: Star,
      color: "bg-yellow-500",
    },
    {
      title: "Response Time",
      value: `${metrics.responseTime}s`,
      icon: Clock,
      color: "bg-green-500",
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                title: "Customize Bot",
                icon: MessageSquare,
                route: "/chatbot",
              },
              { title: "Upload Files", icon: BarChart2, route: "/upload" },
              { title: "View Reports", icon: Star, route: "/performance" },
              { title: "Settings", icon: Clock, route: "/settings" },
            ].map((action) => (
              <Link
                key={action.title}
                to={action.route} // Link to the route when clicked
                className="flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              >
                <action.icon className="w-6 h-6 mb-2 text-blue-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {action.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
