import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bot, ArrowRight, TrendingUp, Settings, Trash2 } from "lucide-react";
import { Legend } from "recharts";
import { useAuth } from "../context/AuthContext";

import { PieChart, Pie, Cell } from "recharts";

import {
  AreaChart,
  Area,
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
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Lock } from "lucide-react";
import { toast } from "react-toastify";

import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip as ttip,
  Legend as lgnd,
} from "chart.js";

ChartJS.register(ArcElement, ttip, lgnd);

const SubscriptionExpiredOverlay = () => {
  const { user } = useAuth();
  const location = useLocation();

  const handleRenewClick = () => {
    // Create state object with string values only
    const state = {
      currentPlanId: user?.subscription_plan_id?.toString() || "",
      fromExpired: "true",
      isExpired: (
        user?.subscription_status === "expired" ||
        user?.subscription_status === "cancelled"
      ).toString(),
      returnTo: location.pathname,
    };

    // Convert to URLSearchParams
    const params = new URLSearchParams();
    Object.entries(state).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    // Open in new tab with query params
    window.open(`/subscription?${params.toString()}`, "_blank");
  };

  const isCancelled = user?.subscription_status === "cancelled";

  return (
    <>
      <div className="fixed inset-0 top-16 z-40 bg-black bg-opacity-50 backdrop-blur-sm">
        <div className="flex items-center justify-center h-full">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl max-w-md text-center">
            <Lock className="w-12 h-12 mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isCancelled ? "Subscription Cancelled" : "Subscription Expired"}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {isCancelled
                ? "Your subscription has been cancelled. Please subscribe again to continue using our services."
                : "Your subscription has expired. Please renew to continue using our services."}
            </p>
            <button
              onClick={handleRenewClick}
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isCancelled ? "Subscribe Now" : "Renew Subscription"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const Welcome = () => {
  const { user, refreshUserData } = useAuth();
  const navigate = useNavigate();
  const userId = user?.user_id;
  const { setSelectedBot } = useBot();
  const { setLoading } = useLoader();
  const {
    plans,
    addons,
    getPlanById,
    getAddonById,
    isLoading: isPlansLoading,
    setPlans,
    setAddons,
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
    message_limits: {
      base_plan: 0,
      addons: 0,
      total: 0
    }
  });

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<number | null>(null);

  const userPlanId = user?.subscription_plan_id || 1;
  const userPlan = getPlanById(userPlanId);

  // Get user's addon IDs (from auth context)
  const userAddonIds = user?.addon_plan_ids || [];
  console.log("Addon plan id=>", userAddonIds);
  const userActiveAddons = addons
    ? addons.filter((addon) => userAddonIds.includes(addon.id))
    : [];
  console.log("Active Addon: ", userActiveAddons);
  const effectiveWordLimit =
    (userPlan?.word_count_limit || 0) +
    userAddonIds.reduce((sum, addonId) => {
      const addon = getAddonById(addonId);
      return sum + (addon?.additional_word_limit || 0);
    }, 0);
  const effectiveMessageLimit =
    (userPlan?.message_limit || 0) +
    userAddonIds.reduce((sum, addonId) => {
      const addon = getAddonById(addonId);
      return sum + (addon?.additional_message_limit || 0);
    }, 0);

  useEffect(() => {
    // Check subscription status when component mounts
    if (user?.subscription_status === "expired") {
      // You might want to force logout or show the overlay
      console.log("Subscription expired");
    }
  }, [user]);

  // Helper function to determine if user should see the expired subscription popup
  const shouldShowExpiredOverlay = () => {
    // Only show the overlay if:
    // 1. User has an expired or cancelled subscription status AND
    // 2. User has a subscription_plan_id (indicating they previously had a subscription)
    return (
      (user?.subscription_status === "expired" ||
        user?.subscription_status === "cancelled") &&
      user?.subscription_plan_id !== undefined
    );
  };

  // Combined data loading effect
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        setIsDataLoaded(false);

        // 1. Load subscription plans first
        const [plansData, addonsData] = await Promise.all([
          authApi.fetchPlans(),
          authApi.fetchAddons(),
        ]);
        console.log("Addons data from API:", addonsData);

        if (Array.isArray(plansData)) {
          setPlans(plansData);
          localStorage.setItem(
            "subscriptionPlans",
            JSON.stringify({
              data: plansData,
              timestamp: Date.now(),
            })
          );
        }

        if (Array.isArray(addonsData)) {
          setAddons(addonsData);
          localStorage.setItem(
            "addonPlans",
            JSON.stringify({
              data: addonsData,
              timestamp: Date.now(),
            })
          );
        }

        // 2. Only proceed with bot data if we have a user ID
        if (userId) {
          const [botResponse, trendsResponse, metrics] = await Promise.all([
            authApi.getBotSettingsByUserId(userId),
            authApi.getConversationTrends(userId),
            authApi.getUsageMetrics(),
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
  }, [userId, setLoading, setPlans, setAddons]);

  if (isPlansLoading || !userPlan) {
    return <Loader />;
  }

  const maxBotsAllowed = userPlan.chatbot_limit;
  //const maxWordsAllowed = userPlan.word_count_limit;
  const maxWordsAllowed = effectiveWordLimit;
  const chatbotlimit = userPlan.chatbot_limit;
  const storagelimit = userPlan.storage_limit;
  //const chat_messages_used = userPlan.message_limit;
  console.log("effectiveMessageLimit", effectiveMessageLimit);
  const chat_messages_used = effectiveMessageLimit;
  const total_message_limit = usageMetrics.message_limits.total;
  console.log("total_message_limit=>", total_message_limit);

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
    navigate("/dashboard/create-bot");

    //navigate("/Options");
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

  const renderCustomLegend = ({ payload }) => {
    return (
      <div className="w-full flex justify-center flex-wrap mt-4">
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center mx-3 my-1">
            <div
              className="w-3 h-3 rounded-sm mr-2"
              style={{ backgroundColor: entry.color }}
            ></div>
            <span
              className="text-sm text-gray-700 dark:text-gray-300"
              style={{ fontFamily: "'Instrument Sans', sans-serif" }}
            >
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderLineGradients = (bots, colors) => (
    <defs>
      {bots.map((bot, index) => (
        <linearGradient
          key={bot.bot_id}
          id={`color-bot-${bot.bot_id}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={colors[index]} stopOpacity={0.2} />
          <stop offset="100%" stopColor={colors[index]} stopOpacity={0} />
        </linearGradient>
      ))}
    </defs>
  );

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
      // <ResponsiveContainer width="100%" height={350}>
      //   <LineChart
      //     data={transformedData}
      //     margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
      //   >
      //     <XAxis
      //       dataKey="day"
      //       stroke="#888888"
      //       tick={{
      //         fill: "#000000", // black color for Y-axis numbers
      //         fontFamily: "'Instrument Sans', sans-serif",
      //         fontSize: 14,
      //         fontWeight: 500,
      //       }}
      //     />
      //     <YAxis
      //       stroke="#888888"
      //       tick={{
      //         fill: "#000000", // black color for Y-axis numbers
      //         fontFamily: "'Instrument Sans', sans-serif",
      //         fontSize: 14,
      //         fontWeight: 500,
      //       }}
      //       label={{
      //         value: "Number of Sessions",
      //         angle: -90,
      //         position: "insideLeft",
      //         dy: 60,
      //         x: 13,
      //         style: {
      //           fontFamily: "'Instrument Sans', sans-serif",
      //           fontSize: 16,
      //           fill: "#666666",
      //           fontWeight: 400, // optional for semi-bold
      //         },
      //       }}
      //       allowDecimals={false}
      //     />
      //     <CartesianGrid strokeDasharray="3 3" />
      //     <Tooltip />
      //     {/* <Legend /> */}
      //     <Legend content={renderCustomLegend} />

      //     {hasData ? (
      //       conversationTrends.map((trend, index) => (
      //         <Line
      //           key={trend.bot_id}
      //           type="monotone"
      //           dataKey={`bot_${trend.bot_id}`}
      //           stroke={colors[index]}
      //           strokeWidth={3}
      //           dot={{ r: 5 }}
      //           activeDot={{ r: 8 }}
      //           name={getBotNameById(trend.bot_id)}
      //         />
      //       ))
      //     ) : (
      //       <Line
      //         type="monotone"
      //         dataKey="bot_0"
      //         stroke={colors[0]}
      //         strokeWidth={2}
      //         dot={{ r: 0 }}
      //         activeDot={false}
      //         name="No Data"
      //       />
      //     )}
      //   </LineChart>
      // </ResponsiveContainer>

      <ResponsiveContainer width="100%" height={350}>
        <AreaChart
          data={transformedData}
          margin={{ top: 20, right: 30, left: 20, bottom: 10 }}
        >
          {/* Gradient definitions */}
          {hasData && renderLineGradients(conversationTrends, colors)}

          <XAxis
            dataKey="day"
            stroke="#888888"
            tick={{
              fill: "#000000",
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
            }}
          />
          <YAxis
            stroke="#888888"
            tick={{
              fill: "#000000",
              fontFamily: "'Instrument Sans', sans-serif",
              fontSize: 14,
              fontWeight: 500,
            }}
            label={{
              value: "Number of Sessions",
              angle: -90,
              position: "insideLeft",
              dy: 60,
              x: 13,
              style: {
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: 16,
                fill: "#666666",
                fontWeight: 400,
              },
            }}
            allowDecimals={false}
          />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip />
          <Legend content={renderCustomLegend} />

          {hasData ? (
            conversationTrends.map((trend, index) => (
              <Area
                key={trend.bot_id}
                type="linear"
                dataKey={`bot_${trend.bot_id}`}
                stroke={colors[index]}
                strokeWidth={1.5}
                fill={`url(#color-bot-${trend.bot_id})`}
                fillOpacity={1}
                dot={false}
                activeDot={false}
                name={getBotNameById(trend.bot_id)}
              />
            ))
          ) : (
            <Area
              type="linear"
              dataKey="bot_0"
              stroke={colors[0]}
              strokeWidth={2}
              fill="url(#color-bot-0)"
              dot={false}
              activeDot={false}
              name="No Data"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const formatNumberWithCommas = (num: number | string): string => {
    // Convert to number if it's a string
    const number = typeof num === "string" ? parseFloat(num) : num;
    return number.toLocaleString("en-US");
  };

  const totalBots = usageMetrics.total_bots || 0;
  const limit = chatbotlimit || 1; // Avoid division by 0

  //const usedPercent = Math.round((totalBots / limit) * 100);

  //pasting code for donut chart

  //Chatbot Count
  const data = {
    labels: ["Used", "Remaining"],
    datasets: [
      {
        data: [totalBots, limit - totalBots],
        backgroundColor: ["#8b5cf6", "#e5e7eb"],
        borderWidth: 0,
      },
    ],
  };

  const options = {
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.raw}`,
        },
      },
    },
  };

  //Chat message
  const chatUsed = usageMetrics.chat_messages_used || 0;
  const chatLimit = total_message_limit || 1; // prevent divide-by-zero

  const chatUsedPercent = Math.round((chatUsed / chatLimit) * 100);

  const chatData = {
    labels: ["Used", "Remaining"],
    datasets: [
      {
        data: [chatUsed, chatLimit - chatUsed],
        backgroundColor: ["#10b981", "#e5e7eb"], // green + light gray
        borderWidth: 0,
      },
    ],
  };

  const chatOptions = {
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${formatNumberWithCommas(ctx.raw)}`,
        },
      },
    },
  };

  //Word Count

  const wordsUsed = usageMetrics.total_words_used || 0;
  const wordLimit = maxWordsAllowed || 1; // to prevent divide-by-zero

  const wordData = {
    labels: ["Used", "Remaining"],
    datasets: [
      {
        data: [wordsUsed, wordLimit - wordsUsed],
        backgroundColor: ["#10b981", "#e5e7eb"], // green + light gray
        borderWidth: 0,
      },
    ],
  };

  const wordOptions = {
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${formatNumberWithCommas(ctx.raw)}`,
        },
      },
    },
  };

  //Storage Used


  const storageUsed = usageMetrics.total_storage_used || 0;
const storageLimit = storagelimit || 1;
const clampedUsed = Math.min(storageUsed, storageLimit);
const remaining = Math.max(storageLimit - clampedUsed, 0);

// Chart Data
const storageData = {
  labels: ["Used", "Remaining"],
  datasets: [
    {
      data: [clampedUsed, remaining],
      backgroundColor: ["#3b82f6", "#e5e7eb"],
      borderWidth: 0,
    },
  ],
};

// Chart Options
const storageOptions = {
  cutout: "70%",
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) =>
          `${ctx.label}: ${ctx.raw.toLocaleString()}`,
      },
    },
  },
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
  const NewUserWelcome = () => {
    const isFreePlan = user?.subscription_plan_id === 1; // Check if user is on free plan

    const handleBuildBotClick = () => {
      if (isFreePlan) {
        navigate("/dashboard/Options"); // Free plan users go to Options
      } else {
        navigate("/dashboard/create-bot"); // All other plans go directly to create-bot
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

  const handleDeleteBot = async () => {
    if (!botToDelete) return;
    try {
      setLoading(true);
      await authApi.deletebot(botToDelete, { status: "Deleted" });
      setIsDeleteConfirmOpen(false);

      // Refresh all data including usage metrics
      const [botResponse, metrics] = await Promise.all([
        authApi.getBotSettingsByUserId(userId!),
        authApi.getUsageMetrics(),
      ]);

      // Update bot list
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
      setHasBots(extractedBots.length > 0);

      // Update usage metrics
      setUsageMetrics(metrics);
    } catch (error) {
      console.error("Failed to delete bot:", error);
      toast.error("Unable to delete your bot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const ExistingUserDashboard = () => (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "22px",
              color: "#333333",
            }}
          >
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2"></p>
          
          {/* Bot Count will be inserted here  */}
          <div
        className="text-left text-[16px] font-normal text-[#333333]"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
       {totalBots} Bots
      </div>



        </div>
        <button
          // onClick={() => navigate("/create-bot")}
          onClick={handleCreateBot}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors "
          style={{
            width: "144px",
            height: "48px",
            fontSize: "16px",
            fontFamily: "'Instrument Sans', sans-serif",
            fontWeight: "500",
            backgroundColor: "#39489D",
          }}
        >
          <span className="mr-2 text-lg font-bold">+</span>
          Create Bot
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
                  onClick={() => navigate("/dashboard/subscription")}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8  ">
        {bots.map((bot) => (
          <div
            key={bot.id}
            onClick={() => {
              setSelectedBot(bot); // ✅ Store selected bot
              navigate("/dashboard/upload"); // ✅ Navigate after setting context
            }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 cursor-pointer 
             transition transform hover:shadow-2xl hover:scale-105 hover:ring-2 hover:ring-blue-400   rounded-[20px]"



  //             className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 
  //            transition transform hover:shadow-2xl hover:scale-105 
  //            hover:ring-2 hover:ring-blue-400 rounded-[20px]"
  // style={{
  //   cursor: 'url("/images/dummy/cursor-icon.png"), auto', // I need to resize the image 31*31 
  // }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                {/* <Bot className="w-8 h-8 text-blue-500 mr-3" /> */}

                <div className="relative w-[56px] h-[56px] mr-3">
                  {/* Ellipse image */}
                  <img
                    src="/images/dummy/Ellipse.png"
                    alt="Bot"
                    className="w-[56px] h-[56px] rounded-full object-cover"
                  />

                  {/* Bot icon centered inside ellipse */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <img
                      src="/images/dummy/bot_icon.png"
                      alt="Bot Icon"
                      className="w-[34px] h-[30px]"
                    />
                  </div>
                </div>

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
                onClick={(e) => {
                  e.stopPropagation();
                  setBotToDelete(bot.id);
                  setIsDeleteConfirmOpen(true);
                }}
                className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div
                className="col-span-2 text-left font-medium text-gray-600 dark:text-gray-300 mt-4"
                style={{
                  fontSize: "14px",
                  fontFamily: "Instrument Sans, sans-serif",
                }}
              >
                Today's Metrics
              </div>

              <div
                className="w-[80%] bg-white rounded-lg p-3 -ml-5 "
                title="Total number of interactions for today"
              >
                <div
                  className="text-center font-semibold text-gray-900 dark:text-white"
                  style={{
                    fontSize: "34px",
                    fontFamily: "Instrument Sans, sans-serif",
                  }}
                >
                  {bot.conversations}
                </div>
                <div
                  className="text-center text-gray-500 dark:text-gray-400 mt-2"
                  style={{
                    fontSize: "14px",
                    fontFamily: "Instrument Sans, sans-serif",
                    color: "#666666",
                  }}
                >
                  Sessions
                </div>
              </div>
              <div
                className="bg-white rounded-lg p-3  "
                title="How many likes and dislikes did the bot receive."
              >
                {/* <div className="text-sm text-gray-500 dark:text-gray-400 ">
                  Feedback
                </div> */}
                <div className="flex flex-col items-center ml-[-80px] ">
                  {/* <span className="text-sm flex items-center space-x-2">
                    <span className="flex items-center text-green-500 space-x-1">
                      <ThumbsUp size={14} />
                      <span>{bot.satisfaction.likes}</span>
                    </span>
                    <span className="text-gray-300 dark:text-gray-500">|</span>
                    <span className="flex items-center text-red-500 space-x-1">
                      <ThumbsDown size={14} />
                      <span>{bot.satisfaction.dislikes}</span>
                    </span>
                  </span> */}

                  <div className="text-sm space-y-1">
                    <div className="flex items-center text-green-500 space-x-1">
                      <img
                        src="/images/dummy/thums-up.png"
                        alt="Thumbs up"
                        className="w-[20px] h-[20px] mr-[10px] mb-[8px]"
                      />
                      <span>{bot.satisfaction.likes}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Positive
                      </span>
                    </div>
                    <div className="flex items-center text-red-500 space-x-1">
                      <img
                        src="/images/dummy/thums-down.png"
                        alt="Thumbs down"
                        className="w-[20px] h-[20px] mr-[10px]"
                      />
                      <span>{bot.satisfaction.dislikes}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        Negative
                      </span>
                    </div>
                  </div>
                  <div
                    className="mt-1"
                    style={{
                      color: "#666666",
                      fontSize: "14px",
                      fontFamily: "Instrument Sans, sans-serif",
                    }}
                  >
                    Feedback
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div
        className="text-left text-[18px] font-normal text-[#333333]"
        style={{ fontFamily: "'Instrument Sans', sans-serif" }}
      >
        Analysis
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 items-stretch">
        <div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8  h-full">
            <div
              style={{
                color: "#666666",
                fontSize: "16px",
                fontFamily: "Instrument Sans, sans-serif",
                fontWeight: "600",
              }}
            >
              Usage Summary
            </div>
            <div>
              {/* Storage Usage */}
              {/* <div className="mb-6">
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
          </div> */}


          {/* Donut Graph */}
 
              <div className="grid grid-cols-2 gap-6">

                 <div className="flex flex-col items-center">



                {/* Storage Usage */}
               
               <div className="flex flex-col items-center mb-6">
    <div className="relative w-24 h-24">
      <Doughnut data={storageData} options={storageOptions} />
    </div>
    <span className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
      {storageUsed.toLocaleString()} / {storagelimit.toLocaleString()}
    </span>
    <span className="text-sm text-gray-600 dark:text-gray-300">
      Storage Used
    </span>
  </div>
                  {/* <div className="text-center text-sm text-gray-600 dark:text-gray-300 mt-2">
            {usageMetrics.total_storage_used} / {storagelimit} used
          </div> */}

                  {/* Chat Usage */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24">
                      <Doughnut data={wordData} options={wordOptions} />
                      {/* ✅ No percentage shown inside */}
                    </div>

                    <span className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumberWithCommas(wordsUsed)} /{" "}
                      {formatNumberWithCommas(wordLimit)}
                    </span>

                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Word Count
                    </span>
                  </div>
                </div>

                {/* Chat Messages */}

                <div>
                  <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24">
                      <Doughnut data={chatData} options={chatOptions} />
                    </div>

                    <span className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumberWithCommas(chatUsed)} /{" "}
                      {formatNumberWithCommas(chatLimit)}
                    </span>

                    <span className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Chat Messages
                    </span>
                  </div>

                  {/* Total Chatbots */}
                  {/* <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Total Bots
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
          </div> */}

                  <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24">
                      <Doughnut data={data} options={options} />
                      <div className="absolute inset-0 flex items-center justify-center"></div>
                    </div>

                    {/* ✅ Show used/limit below the graph */}
                    <span className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      {totalBots} / {limit}
                    </span>

                    {/* ✅ "Total Bots" label underneath that */}
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      Total Bots
                    </span>
                  </div>
                </div>
              </div>
            </div>{" "}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {/* <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            This graph displays the number of session users had with the
            chatbot. An session is counted each time a user sends a message.
            The session ends when the user becomes inactive or leaves the chat.
          </p> */}
          <div className="flex items-center justify-between mb-4">
            <h2
              className="font-semibold"
              style={{
                fontFamily: "'Instrument Sans', sans-serif",
                fontSize: "16px",
                color: "#666666",
              }}
            >
              Bot Session Trend – Last 7 Days
            </h2>
            {/* Info Tooltip */}
            <div className="relative group">
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
      </div>
      {/* Delete confirmation modal - matches chatbotcustomization.tsx */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Confirm Deletion</h2>
            <p>Do you wish to delete this bot?</p>
            <div className="mt-4 flex justify-end">
              <button
                className="bg-gray-300 text-black px-4 py-2 rounded mr-2"
                onClick={() => setIsDeleteConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded"
                onClick={handleDeleteBot}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] p-6 bg-gradient-to-b from  to-white dark:from-gray-900 dark:to-gray-800">
      {shouldShowExpiredOverlay() && <SubscriptionExpiredOverlay />}
      <Loader />
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
