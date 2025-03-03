import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  ArrowRight,
  TrendingUp,
  Settings,
  MessageSquare,
  Users,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";

export const Welcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.user_id;
  const { setSelectedBot } = useBot();
  // This would come from your API in a real app
  //const [hasBots] = useState(true);
  const [hasBots, setHasBots] = useState<boolean | null>(null); // Track bot existence
  const [bots, setBots] = useState<
    { id: number; name: string; status: string }[] // to display the bots in the tiles
  >([]);

  useEffect(() => {
    const checkUserBot = async () => {
      try {
        if (userId === undefined) return; // Ensure userId is defined before making API call

        const response = await authApi.getBotSettingsByUserId(userId);
        const botExists = response.length > 0; // Check if bot_id is present
        setHasBots(botExists);
        // Extract bot data dynamically
        // Ensure response is treated as an array
        const extractedBots = response.map((botObj) => {
          const botId = Object.keys(botObj)[0]; // Extract the bot ID (key)
          const botData = botObj[botId]; // Extract the corresponding bot details

          return {
            id: Number(botId), // Convert string ID to number
            name: botData.bot_name,
            status: botData.is_active ? "active" : "inactive",
            //conversations: 0, // Placeholder for conversations
            //satisfaction: 0, // Placeholder for satisfaction
          };
        });

        console.log("extractedBots", extractedBots);

        setBots(extractedBots);
      } catch (error) {
        console.error("Error checking user bot:", error);
        setHasBots(false); // Assume no bot in case of error
      }
    };
    checkUserBot();
  }, [userId]);

  if (hasBots === null) {
    return <div>Loading...</div>; // Show loading state while API call is in progress
  }
  const recentData = [
    { day: "Mon", conversations: 145 },
    { day: "Tue", conversations: 132 },
    { day: "Wed", conversations: 164 },
    { day: "Thu", conversations: 189 },
    { day: "Fri", conversations: 176 },
    { day: "Sat", conversations: 141 },
    { day: "Sun", conversations: 184 },
  ];

  // const bots = [
  //   {
  //     id: 1,
  //     name: "Support Bot",
  //     status: "active",
  //     conversations: 1289,
  //     satisfaction: 94,
  //   },
  //   {
  //     id: 2,
  //     name: "Sales Assistant",
  //     status: "active",
  //     conversations: 856,
  //     satisfaction: 89,
  //   },
  // ];

  const NewUserWelcome = () => (
    <div className="text-center max-w-2xl mx-auto">
      <div className="mb-8 flex justify-center">
        <div className="p-4 bg-blue-500 rounded-full">
          <Bot className="w-12 h-12 text-white" />
        </div>
      </div>
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Welcome, {user?.name}!
      </h1>
      <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
        Build your AI Bot in Minutes!
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
        Enter your website URL, upload your docs, and let AI do the rest.
      </p>
      <button
        // onClick={() => navigate("/create-bot")}
        onClick={() => navigate("/Options")}
        className="inline-flex items-center px-6 py-3 text-lg font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
      >
        Build your Bot
        <ArrowRight className="ml-2 w-5 h-5" />
      </button>
    </div>
  );

  const ExistingUserDashboard = () => (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Your bots are performing well. Here's an overview of the last 7
            days.
          </p>
        </div>
        <button
          // onClick={() => navigate("/create-bot")}
          onClick={() => navigate("/Options")}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Create New Bot
          <ArrowRight className="ml-2 w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {bots.map((bot) => (
          <div
            key={bot.id}
            onClick={() => {
              setSelectedBot(bot); // ✅ Store selected bot
              navigate("/chatbot"); // ✅ Navigate after setting context
            }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer 
             transition transform hover:shadow-2xl hover:scale-105 hover:ring-2 hover:ring-blue-400"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Bot className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {bot.name}
                  </h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    {bot.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedBot(bot); // ✅ Store selected bot
                  navigate("/chatbot"); // ✅ Navigate after setting context
                }}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Conversations
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">
                  0
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Satisfaction
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">
                  0
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Conversation Trends
            </h2>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={recentData}>
                <XAxis dataKey="day" stroke="#888888" />
                <YAxis stroke="#888888" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="conversations"
                  stroke="#3B82F6"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="space-y-3">
            {[
              {
                icon: MessageSquare,
                label: "Customize Responses",
                path: "/chatbot",
              },
              { icon: Users, label: "View Analytics", path: "/performance" },
              { icon: Settings, label: "Bot Settings", path: "/settings" },
            ].map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center">
                  <action.icon className="w-5 h-5 text-blue-500 mr-3" />
                  <span className="text-gray-700 dark:text-gray-300">
                    {action.label}
                  </span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-400" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {hasBots ? <ExistingUserDashboard /> : <NewUserWelcome />}
    </div>
  );
};
