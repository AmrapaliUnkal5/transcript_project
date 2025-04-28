import React from "react";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Lock } from "lucide-react";
import { useBot } from "../context/BotContext";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { authApi } from "../services/api";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";

interface ConversationData {
  day: string;
  count: number;
}

interface FAQData {
  question: string;
  count: number;
  cluster_id: string;
}

const COLORS = ["#4CAF50", "#F44336", "#2196F3", "#FFC107", "#F44336"];

const UpgradeMessage = ({
  requiredPlan = "Starter",
  feature = "analytics",
}) => {
  return (
    <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600 shadow-lg w-64 text-center">
      <Lock className="w-6 h-6 mx-auto text-gray-400 mb-2" />
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
        {feature === "analytics" ? "Analytics Locked" : "Feature Locked"}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
        {feature === "analytics"
          ? `Upgrade to ${requiredPlan} plan to view analytics.`
          : `Upgrade to ${requiredPlan} plan for detailed metrics.`}
      </p>
      <div className="flex justify-center">
        <a
          href="/subscription"
          className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs font-medium"
        >
          Upgrade
        </a>
      </div>
    </div>
  );
};

export const Performance = () => {
  const { loading, setLoading } = useLoader();
  const { selectedBot } = useBot();
  const [satisfactionData, setSatisfactionData] = useState([
    { name: "Likes", value: 0 },
    { name: "Dislikes", value: 0 },
    { name: "Neutral", value: 0 },
  ]);
  const [timeSpentData, setTimeSpentData] = useState<
    { day: string; average_time_spent: number }[]
  >([]);
  const [conversationData, setConversationData] = useState<ConversationData[]>(
    []
  );
  const [faqData, setFaqData] = useState<FAQData[]>([]);
  const [totalTimeSpent, setTotalTimeSpent] = useState<number>(0);

  const userData = localStorage.getItem("user");
  const user = userData ? JSON.parse(userData) : null;
  // const userPlan: SubscriptionPlan = getPlanById(user?.subscription_plan_id);
  // const hasNoAnalyticsAccess = user?.subscription_plan_id === 1;
  // const hasAdvancedAnalytics = user?.subscription_plan_id === 4;
  const { getPlanById } = useSubscriptionPlans();
  const userPlan = getPlanById(user?.subscription_plan_id);
  const hasNoAnalyticsAccess = userPlan?.id === 1; // Free plan
  const hasAdvancedAnalytics = userPlan?.id === 4; // Professional plan
  const [totalConversations, setTotalConversations] = useState(0);

  const getLast7DaysFormatted = () => {
    const days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const monthName = date.toLocaleDateString("en-US", { month: "short" });
      const dayNumber = date.getDate();

      days.push(`${dayName} ${monthName} ${dayNumber}`);
    }

    return days;
  };

  function formatToHourMinute(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  }

  const fetchConversationData = async () => {
    if (!selectedBot?.id) return;

    try {
      setLoading(true);
      const response = await authApi.getWeeklyConversations({
        bot_id: selectedBot.id,
      });
      const data = response?.data || response || {};
      const expectedDays = getLast7DaysFormatted();
      const formattedData = expectedDays.map((day) => ({
        day,
        count: data[day] || 0,
      }));
      setConversationData(formattedData);
      setTotalConversations(
        formattedData.reduce((sum, day) => sum + day.count, 0)
      );
    } catch (error) {
      console.error("Error fetching conversation data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSatisfactionData = async () => {
    try {
      if (!selectedBot?.id) return;
      setLoading(true);
      const response = await authApi.fetchBotMetrics(selectedBot.id);
      const { likes, dislikes, neutral } = response.reactions;

      const updatedData = [];
      if (likes > 0) updatedData.push({ name: "Likes", value: likes });
      if (dislikes > 0) updatedData.push({ name: "Dislikes", value: dislikes });
      if (updatedData.length === 0) {
        updatedData.push({ name: "Neutral", value: 100 });
      } else if (neutral > 0) {
        updatedData.push({ name: "Neutral", value: neutral });
      }

      setSatisfactionData(updatedData);

      const apiData = response.average_time_spent;
      console.log("apiData", apiData);
      const orderedDays = getLast7Days();
      const fullDayMap: Record<
        "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat",
        string
      > = {
        Sun: "Sunday",
        Mon: "Monday",
        Tue: "Tuesday",
        Wed: "Wednesday",
        Thu: "Thursday",
        Fri: "Friday",
        Sat: "Saturday",
      };

      const formattedData = orderedDays.map((shortDay) => {
        const fullDay = fullDayMap[shortDay as keyof typeof fullDayMap];
        return {
          day: shortDay,
          average_time_spent:
            apiData.find((item) => item.day === fullDay)?.average_time_spent ||
            0,
        };
      });

      setTimeSpentData(formattedData);
      const totalMinutes = apiData.reduce(
        (sum, item) => sum + (item.average_time_spent || 0),
        0
      );

      // Convert total minutes to "Xm Ys" format
      const formattedTime = formatToHourMinute(totalMinutes);
      setTotalTimeSpent(formattedTime);
    } catch (error) {
      console.error("Error fetching bot metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const [billingCycleMetrics, setBillingCycleMetrics] = useState({
    totalSessions: 0,
    totalUserMessages: 0,
    totalLikes: 0,
    totalDislikes: 0,
    totalChatDuration: "0h 0m 0s",
  });

  const fetchBillingCycleMetrics = async () => {
    if (!selectedBot?.id) return;
  
    try {
      setLoading(true);
      const response = await authApi.getCurrentBillingMetrics({
        bot_id: selectedBot.id,
      });
      setBillingCycleMetrics({
        totalSessions: response.total_sessions,
        totalUserMessages: response.total_user_messages,
        totalLikes: response.total_likes,
        totalDislikes: response.total_dislikes,
        totalChatDuration: response.total_chat_duration,
      });
    } catch (error) {
      console.error("Error fetching billing cycle metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFaqData = async () => {
    if (!selectedBot?.id) return;

    try {
      setLoading(true);
      const response = await authApi.getFAQ({
        bot_id: selectedBot.id,
      });
      const faqs = response?.data || response || [];

      const formattedData = faqs
        .map((faq: any) => ({
          question: faq.question,
          count: faq.count,
          cluster_id: faq.cluster_id,
        }))
        .slice(0, 10); // Only take first 10 FAQs

      setFaqData(formattedData);
    } catch (error) {
      console.error("Error fetching FAQ data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLast7Days = () => {
    const shortDaysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const todayIndex = new Date().getDay();
    return [...Array(7)].map(
      (_, i) => shortDaysOfWeek[(todayIndex - 6 + i + 7) % 7]
    );
  };

  useEffect(() => {
    fetchConversationData();
    fetchSatisfactionData();
    fetchFaqData();
    fetchBillingCycleMetrics();
  }, [selectedBot?.id]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Performance Metrics
        </h1>
      </div>

      <div className="relative">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${
            hasNoAnalyticsAccess ? "filter blur-xl pointer-events-none" : ""
          }`}
        >
          {/* Weekly Conversations Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
           User Messages Trend – Last 7 Days
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversationData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    angle={-45}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis domain={[0, "dataMax + 1"]} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#2196F3"
                    name="Total Conversations"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average Time Spent Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Average Chat Duration – Last 7 Days
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSpentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" angle={-20} textAnchor="end" />
                  <YAxis
                    label={{
                      value: "Minutes",
                      angle: -90,
                      position: "insideLeft",
                    }}
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value} min`,
                      "Avg Time Spent",
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="average_time_spent"
                    stroke="#4CAF50"
                    name="Avg Time Spent (s)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Satisfaction Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            User Feedback – Last 7 Days
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={satisfactionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {satisfactionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Metrics Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Current Billing Cycle Metrics
            </h2>
            <div
              className={`overflow-x-auto ${
                !hasAdvancedAnalytics ? "filter blur-xl" : ""
              }`}
            >
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Metric
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Value
                    </th>
                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Change
                    </th> */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {[
                    {
                      metric: "Total Sessions",
                      value: billingCycleMetrics.totalSessions.toLocaleString(),
                    },
                    {
                      metric: "Total User Messages",
                      value: billingCycleMetrics.totalUserMessages.toLocaleString(),
                    },
                    {
                      metric: "Total Likes",
                      value: billingCycleMetrics.totalLikes.toLocaleString(),
                    },
                    {
                      metric: "Total Dislikes",
                      value: billingCycleMetrics.totalDislikes.toLocaleString(),
                    },
                    {
                      metric: "Total Chat Duration",
                      value: billingCycleMetrics.totalChatDuration,
                    },
                    
                  ].map((item) => (
                    <tr
                      key={item.metric}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.metric}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.value}
                      </td>
                      {/* <td
                        className={`px-6 py-4 whitespace-nowrap text-sm ${
                          item.positive
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {item.change}
                      </td> */}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!hasAdvancedAnalytics && (
              <div className="absolute top-[50%] left-[75%] transform -translate-x-1/2 -translate-y-1/2 z-10">
                <UpgradeMessage
                  requiredPlan="Professional"
                  feature=" detailed analytics"
                />
              </div>
            )}
          </div>
          {/* FAQ Analytics Chart */}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-[420px]">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Frequently Asked Questions by Users
            </h2>
            <div
              className={`h-[calc(100%-40px)] overflow-y-auto ${
                !hasAdvancedAnalytics ? "filter blur-xl" : ""
              }`}
            >
              {faqData.length > 0 ? (
                <div className="space-y-3">
                  {faqData.map((faq, index) => (
                    <div key={index} className="group">
                      <p className="text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {`${index + 1}. ` +
                          faq.question
                            .split(" ")
                            .map(
                              (word) =>
                                word.charAt(0).toUpperCase() +
                                word.slice(1).toLowerCase()
                            )
                            .join(" ")}
                      </p>
                      {/* <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Asked {faq.count} {faq.count === 1 ? 'time' : 'times'}
            </p> */}
                    </div>
                  ))}
                  {/* Fill remaining space if less than 10 questions */}
                  {faqData.length < 10 && (
                    <div className="h-[calc((10-${faqData.length})*60px)]"></div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No frequently asked questions data available yet.
                  </p>
                </div>
              )}
            </div>
            {!hasAdvancedAnalytics && (
              <div className="absolute top-[85%] left-[25%] transform -translate-x-1/2 -translate-y-1/2 z-10">
                <UpgradeMessage
                  requiredPlan="Professional"
                  feature="FAQ analytics"
                />
              </div>
            )}
          </div>
        </div>

        {hasNoAnalyticsAccess && (
          <div className="absolute top-[30%] left-[35%] transform -translate-x-1/6 -translate-y-1/16 z-10">
            <UpgradeMessage requiredPlan="Starter" feature="analytics" />
          </div>
        )}
      </div>
    </div>
  );
};