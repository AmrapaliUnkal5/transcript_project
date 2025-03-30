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
import { Legend } from "recharts";
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
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";

export const Welcome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.user_id;
  const { setSelectedBot } = useBot();
  // This would come from your API in a real app
  //const [hasBots] = useState(true);
  const [hasBots, setHasBots] = useState<boolean | null>(null); // Track bot existence
  const { setLoading } = useLoader(); // Get loader state from context
  const [bots, setBots] = useState<
    { id: number; name: string; status: string }[] // to display the bots in the tiles
  >([]);
  const [conversationTrends, setConversationTrends] = useState<any[]>([]); // State to store conversation trends
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const handleCreateBot = () => {
    //TEMPORARY: This maybe need to be taken as an API . the limits of a subsccription.
    const planLimits = {
      1: 1, // Free Plan
      2: 2, // Basic Plan
      3: 2, // Growth Plan
      4: 5, // Professional Plan
    };

    const userPlanId = user?.subscription_plan_id || 1; // Default to Free Plan
    const maxBotsAllowed = planLimits[userPlanId];
    const userBotCount = bots?.length || 0; // Get bot count from already fetched bots
    console.log(userBotCount);

    if (userBotCount >= maxBotsAllowed) {
      setModalMessage(
        `You already have ${userBotCount} bots. Your plan allows only ${maxBotsAllowed} bot(s). Upgrade to create more.`
      );
      setIsModalOpen(true);
      return;
    }

    navigate("/Options");
  };

  useEffect(() => {
    const checkUserBot = async () => {
      try {
        if (userId === undefined) return; // Ensure userId is defined before making API call
        setLoading(true); // Show loader before API call

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
            status: botData.status,
            //conversations: 0, // Placeholder for conversations
            //satisfaction: 0, // Placeholder for satisfaction
          };
        });

        console.log("extractedBots", extractedBots);

        setBots(extractedBots);
        const trendsResponse = await authApi.getConversationTrends(userId);
        //console.log(trendsResponse);
        setConversationTrends(trendsResponse);
      } catch (error) {
        console.error("Error checking user bot:", error);
        setHasBots(false); // Assume no bot in case of error
      } finally {
        setLoading(false); // Hide loader after API call
      }
    };
    checkUserBot();
  }, [userId, setLoading]);

  const transformDataForGraph = (trends: any[]) => {
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date().getDay(); // Get the current day of the week (0 = Sunday, 1 = Monday, etc.)

    const graphData: any[] = [];

    // Loop through all days of the week
    daysOfWeek.forEach((day, index) => {
      const dayData: any = { day };

      trends.forEach((trend) => {
        const botId = trend.bot_id;

        // For days up to today, plot the data (or 0 if no data exists)
        if (index <= today) {
          const botDayData = trend.data.find((d: any) => d.day === day);
          dayData[`bot_${botId}`] = botDayData ? botDayData.conversations : 0;
        } else {
          // For future days, set the value to null (no plotting)
          dayData[`bot_${botId}`] = null;
        }
      });

      graphData.push(dayData);
    });

    return graphData;
  };

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
    const transformedData = transformDataForGraph(conversationTrends);
    const colors = generateColors(conversationTrends.length);

    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={transformedData}>
          <XAxis dataKey="day" stroke="#888888" />
          <YAxis stroke="#888888" />
          <Tooltip />
          <Legend />
          {conversationTrends.map((trend, index) => (
            <Line
              key={trend.bot_id}
              type="monotone"
              dataKey={`bot_${trend.bot_id}`}
              stroke={colors[index]}
              strokeWidth={2}
              name={getBotNameById(trend.bot_id)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  if (hasBots === null) {
    return <Loader />; // Show loading state while API call is in progress
  }

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
          <div className="h-64">{renderGraph()}</div>
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
