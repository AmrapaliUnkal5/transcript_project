import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, ArrowRight, TrendingUp, Settings } from "lucide-react";
import { Legend } from "recharts";
import { useAuth } from "../context/AuthContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { authApi } from "../services/api";
import { useBot } from "../context/BotContext";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";
// import { UserUsage } from "../types/index";
// import { getPlanById, SubscriptionPlan } from "../types/index";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";

export const Welcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.user_id;
  const { setSelectedBot } = useBot();
  const { setLoading } = useLoader();
  const { 
    plans, 
    getPlanById, 
    isLoading: isPlansLoading, 
    setPlans, 
    setLoading: setPlansLoading 
  } = useSubscriptionPlans();
  // This would come from your API in a real app
  //const [hasBots] = useState(true);
  const [hasBots, setHasBots] = useState<boolean | null>(null); // Track bot existence
  const [isDataLoaded, setIsDataLoaded] = useState(false);
    const [bots, setBots] = useState<
    {
      id: number;
      name: string;
      status: string;
      conversations: number;
      satisfaction: {
        likes: number;
        dislikes: number;
      };
    }[] // to display the bots in the tiles
  >([]);
  interface ConversationTrend {
    bot_id: number;
    data: { day: string; conversations: number }[];
  }
  const [conversationTrends, setConversationTrends] = useState<
    ConversationTrend[]
  >([]); // State to store conversation trends
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [usageMetrics, setUsageMetrics] = useState({
    total_words_used: 0,
    chat_messages_used: 0,
    total_bots: 0,
    total_storage_used: "0",
  });

  const userPlanId = user?.subscription_plan_id || 1;
  const userPlan = getPlanById(userPlanId);

// Combined data loading effect
useEffect(() => {
  const loadAllData = async () => {
    try {
      setLoading(true);
      setIsDataLoaded(false);
      
      // 1. Load subscription plans first
      const plansData = await authApi.fetchPlans();
      if (Array.isArray(plansData)) {
        setPlans(plansData);
        localStorage.setItem('subscriptionPlans', 
          JSON.stringify({ 
            data: plansData, 
            timestamp: Date.now() 
          }));
      }

      // 2. Only proceed with bot data if we have a user ID
      if (userId) {
        const [botResponse, trendsResponse, metrics] = await Promise.all([
          authApi.getBotSettingsByUserId(userId),
          authApi.getConversationTrends(userId),
          authApi.getUsageMetrics()
        ]);

        // Process bot data
        const botExists = botResponse.length > 0;
        setHasBots(botExists);

        const extractedBots = botResponse.map((botObj) => {
          const botId = Object.keys(botObj)[0];
          const botData = botObj[botId];

          return {
            id: Number(botId),
            name: botData.bot_name,
            status: botData.status,
            conversations: botData.conversation_count_today,
            satisfaction: {
              likes: botData.satisfaction?.likes || 0,
              dislikes: botData.satisfaction?.dislikes || 0,
            },
          };
        });

        setBots(extractedBots);
        setConversationTrends(trendsResponse);
        setUsageMetrics(metrics);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setHasBots(false);
    } finally {
      setLoading(false);
      setIsDataLoaded(true);
    }
  };

  loadAllData();
}, [userId, setLoading, setPlans]);

if (isPlansLoading || !userPlan) {
  return <Loader />;
}

const maxBotsAllowed = userPlan.chatbot_limit;
const maxWordsAllowed = userPlan.word_count_limit;
const chatbotlimit = userPlan.chatbot_limit;
const storagelimit = userPlan.storage_limit;
const chat_messages_used = userPlan.message_limit;

const usedBytes = convertToBytes(usageMetrics.total_storage_used);
const limitBytes = convertToBytes(storagelimit);
const storageUsagePercent = Math.min(
  (usedBytes / limitBytes) * 100,
  100
).toFixed(2);

  function convertToBytes(sizeStr: string): number {
    if (!sizeStr) return 0;

    const match = sizeStr
      .trim()
      .toUpperCase()
      .match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/);
    if (!match) return 0;

    const [, valueStr, unit] = match;
    const value = parseFloat(valueStr);

    const unitMultipliers: { [key: string]: number } = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    };

    return value * (unitMultipliers[unit] || 1);
  }

  const handleCreateBot = () => {
    //const userPlanId = user?.subscription_plan_id || 1; // Default to Free Plan
    // ✅ Add a loading check

    //const userPlan = getPlanById(userPlanId);

    console.log("userPlan", userPlan);
    if (!userPlan) return;

    //const maxBotsAllowed = userPlan.chatbot_limit;
    //const maxWordsAllowed = userPlan.word_count_limit;
    console.log("maxBotsAllowed", maxBotsAllowed);
    const userBotCount = bots?.length || 0; // Get bot count from already fetched bots
    console.log(userBotCount);

    if (userBotCount >= maxBotsAllowed) {
      setModalMessage(
        `You already have ${userBotCount} bots. Your plan allows only ${maxBotsAllowed} bot(s). Upgrade to create more.`
      );
      setIsModalOpen(true);
      return;
    }
    navigate("/create-bot");

    //navigate("/Options");
  };

  
  // const transformDataForGraph = (trends: any[]) => {
  //   const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  //   const today = new Date().getDay(); // Get the current day of the week (0 = Sunday, 1 = Monday, etc.)

  //   const graphData: any[] = [];

  //   // Loop through all days of the week
  //   daysOfWeek.forEach((day, index) => {
  //     const dayData: any = { day };

  //     trends.forEach((trend) => {
  //       const botId = trend.bot_id;

  //       // For days up to today, plot the data (or 0 if no data exists)
  //       if (index <= today) {
  //         const botDayData = trend.data.find((d: any) => d.day === day);
  //         dayData[`bot_${botId}`] = botDayData ? botDayData.conversations : 0;
  //       } else {
  //         // For future days, set the value to null (no plotting)
  //         dayData[`bot_${botId}`] = null;
  //       }
  //     });

  //     graphData.push(dayData);
  //   });

  //   return graphData;
  // };

  // Generate a unique color for each bot
  const generateColors = (count: number) => {
    const colors = [
      "#3B82F6", // Blue
      "#EF4444", // Red
      "#10B981", // Green
      "#F59E0B", // Yellow
      "#8B5CF6", // Purple
      "#EC4899", // Pink
      "#6EE7B7", // Teal
    ];
    return colors.slice(0, count);
  };

  // Function to get bot name by bot ID
  const getBotNameById = (botId: number) => {
    const bot = bots.find((bot) => bot.id === botId);
    return bot ? bot.name : `Bot ${botId}`; // Fallback to "Bot X" if name is not found
  };

  // Render the graph
  const renderGraph = () => {
    const hasData = conversationTrends.length > 0;
    // Generate last 7 days as fallback data
    // Generate last 7 day names (e.g., Mon, Tue, Wed...)
    const getLast7DayNames = () => {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(today);
        day.setDate(today.getDate() - (6 - i));
        return day.toLocaleDateString("en-US", { weekday: "short" }); // 'Mon', 'Tue', etc.
      });
    };

    const fallbackDays = getLast7DayNames();

    const fallbackData = fallbackDays.map((day) => ({
      day,
      bot_0: 0,
    }));

    const transformedData = hasData
      ? transformDataForGraph(conversationTrends)
      : fallbackData;
    const colors = hasData
      ? generateColors(conversationTrends.length)
      : ["#8884d8"];
    // Example insights (You can generate these dynamically based on data)

    return (
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={transformedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        >
          <XAxis dataKey="day" stroke="#888888" />
          <YAxis
            stroke="#888888"
            label={{
              value: "Number of Interactions",
              angle: -90,
              position: "insideLeft",
              dy: 30,
              x: 13,
            }}
            allowDecimals={false}
          />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip />
          <Legend />
          {hasData ? (
            conversationTrends.map((trend, index) => (
              <Line
                key={trend.bot_id}
                type="monotone"
                dataKey={`bot_${trend.bot_id}`}
                stroke={colors[index]}
                strokeWidth={3}
                dot={{ r: 5 }}
                activeDot={{ r: 8 }}
                name={getBotNameById(trend.bot_id)}
              />
            ))
          ) : (
            <Line
              type="monotone"
              dataKey="bot_0"
              stroke={colors[0]}
              strokeWidth={2}
              dot={{ r: 0 }}
              activeDot={false}
              name="No Data"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const transformDataForGraph = (conversationTrends: ConversationTrend[]) => {
    // Extract all days from the first bot (since all bots will have all 7 days)
    const days =
      conversationTrends.length > 0
        ? conversationTrends[0].data.map((item) => item.day)
        : [];

    // For each day, collect the conversations for all bots
    const transformedData = days.map((day, index) => {
      const dayData: Record<string, number | string> = { day };

      conversationTrends.forEach((trend) => {
        const botKey = `bot_${trend.bot_id}`;
        dayData[botKey] = trend.data[index].conversations; // Index is safe since all bots have 7 days
      });

      return dayData;
    });

    return transformedData;
  };

  // const getLast7Days = () => {
  //   const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  //   const today = new Date();
  //   const last7Days = [];

  //   for (let i = 6; i >= 0; i--) {
  //     const day = new Date();
  //     day.setDate(today.getDate() - i);
  //     last7Days.push(days[day.getDay()]); // Get weekday name
  //   }

  //   return last7Days;
  // };

  // if (hasBots === null) {
  //   return <Loader />; // Show loading state while API call is in progress
  // }

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

  const NewUserWelcome = () => {
    const isFreePlan = user?.subscription_plan_id === 1; // Check if user is on free plan

    const handleBuildBotClick = () => {
      if (isFreePlan) {
        navigate("/Options"); // Free plan users go to Options
      } else {
        navigate("/create-bot"); // All other plans go directly to create-bot
      }
    };

    return (
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
          onClick={handleBuildBotClick}
          className="inline-flex items-center px-6 py-3 text-lg font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Build your Bot
          <ArrowRight className="ml-2 w-5 h-5" />
        </button>
      </div>
    );
  };

  const ExistingUserDashboard = () => (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2"></p>
        </div>
        <button
          // onClick={() => navigate("/create-bot")}
          onClick={handleCreateBot}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Create New Bot
          <ArrowRight className="ml-2 w-4 h-4" />
        </button>
        {/* Modal Popup (Reusing Existing Modal) */}
        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 backdrop-blur-sm">
            <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full z-50">
              <h2 className="text-lg font-semibold mb-2">Upgrade Required</h2>
              <p className="mb-4">{modalMessage}</p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-gray-300 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => navigate("/subscription")}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        )}
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
              <div className="col-span-2 text-center text-sm font-medium text-gray-600 dark:text-gray-300">
                📅 Today's Metrics
              </div>
              <div
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                title="Total number of interactions for today"
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Sessions
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">
                  {bot.conversations}
                </div>
              </div>
              <div
                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3"
                title="How many likes and dislikes did the bot receive."
              >
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Feedback
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">
                  <span className="text-sm">
                    <span className="text-green-500">
                      👍 {bot.satisfaction.likes}
                    </span>
                    <span className="mx-1 text-gray-300 dark:text-gray-500">
                      |
                    </span>
                    <span className="text-red-500">
                      👎 {bot.satisfaction.dislikes}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage Summary
          </h2>

          {/* Storage Usage */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Storage Used
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usageMetrics.total_storage_used}/ {storagelimit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
              <div
                className="bg-blue-500 h-3 rounded-full"
                style={{ width: `${storageUsagePercent}%` }}
              ></div>
            </div>
          </div>

          {/* Chat Usage */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Word Count
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usageMetrics.total_words_used} / {maxWordsAllowed}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
              <div
                className="bg-green-500 h-3 rounded-full"
                style={{
                  width: `${Math.min(
                    (usageMetrics.total_words_used / maxWordsAllowed) * 100,
                    100
                  ).toFixed(2)}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Chat Messages
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usageMetrics.chat_messages_used} / {chat_messages_used}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
              <div
                className="bg-green-500 h-3 rounded-full"
                style={{
                  width: `${Math.min(
                    (usageMetrics.chat_messages_used / chat_messages_used) *
                      100,
                    100
                  ).toFixed(2)}%`,
                }}
              ></div>
            </div>
          </div>

          {/* Total Chatbots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Total Chatbots
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {usageMetrics.total_bots}/ {chatbotlimit}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
              <div
                className="bg-purple-500 h-3 rounded-full"
                style={{
                  width: `${Math.min(
                    (usageMetrics.total_bots / chatbotlimit) * 100,
                    100
                  ).toFixed(2)}%`,
                }}
              ></div>
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            This graph displays the number of interactions users had with the
            chatbot. An interaction is counted each time a user sends a message.
            The session ends when the user becomes inactive or leaves the chat.
          </p> */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Bot Session Trends
            </h2>
            {/* Info Tooltip */}
            <div className="relative group">
              <span className="text-gray-500 hover:text-blue-500 cursor-pointer">
                ℹ️
              </span>
              <div className="absolute left-0 top-7 w-64 bg-gray-800 text-white text-xs rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg">
                This graph shows the number of chatbot interaction last seven
                days. Each interaction starts when a user sends a message and
                ends when they become inactive or leave the session.
              </div>
            </div>

            <TrendingUp className="w-5 h-5 text-blue-500 ml-auto mr-4" />
          </div>
          <div className="h-96 overflow-hidden">{renderGraph()}</div>
        </div>

        {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
        </div> */}
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
      {!isDataLoaded || hasBots === null ? (
      <Loader /> // Show loader while data is loading
    ) : hasBots ? (
      <ExistingUserDashboard />
    ) : (
      <NewUserWelcome />
    )}
  </div>
);
};