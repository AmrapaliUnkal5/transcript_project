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
import { Construction, Download } from "lucide-react";
import { useBot } from "../context/BotContext";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { authApi } from "../services/api";

interface ConversationData {
  day: string;
  count: number;
}

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
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);

  // Fetch conversation data from the API
  const fetchConversationData = async () => {
    if (!selectedBot?.id) {
      console.error("Bot ID is missing.");
      return;
    }

    try {
      setLoading(true);
      const response = await authApi.getWeeklyConversations({
        bot_id: selectedBot.id,
      });
      const data = response?.data || response || {};

      if (!data || typeof data !== "object") {
        console.error("Invalid data format received:", data);
        return;
      }

      // Convert the API response to an array of { day, count } objects
      const formattedData = Object.entries(data).map(([day, count]) => ({
        day: day.substring(0, 3), // Abbreviate day names (e.g., "Monday" -> "Mon")
        count: Number(count),
      }));

      // Ensure all days of the week are present in the data
      const daysOfWeek = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const completeData = daysOfWeek.map((day) => {
        const existingData = formattedData.find((d) => d.day === day);
        return existingData || { day, count: 0 }; // Default to 0 if no data for the day
      });

      setConversationData(completeData);
    } catch (error) {
      console.error("Error fetching conversation data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch satisfaction data
  const fetchSatisfactionData = async () => {
    try {
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }
      setLoading(true);
      const response = await authApi.fetchBotMetrics(selectedBot.id);
      const { likes, dislikes, neutral } = response.reactions;

      const updatedData = [];

      if (likes > 0) {
        updatedData.push({ name: "Likes", value: likes });
      }
      if (dislikes > 0) {
        updatedData.push({ name: "Dislikes", value: dislikes });
      }
      if (updatedData.length === 0) {
        updatedData.push({ name: "Neutral", value: 100 });
      } else if (neutral > 0) {
        updatedData.push({ name: "Neutral", value: neutral });
      }

      setSatisfactionData(updatedData);

      const apiData = response.average_time_spent;
      console.log("apiData", apiData);
      const orderedDays = getLast7Days();
      const formattedData = orderedDays.map((day) => {
        const found = apiData.find((item) => item.day === day);
        return {
          day,
          average_time_spent: found ? found.average_time_spent : 0,
        };
      });

      setTimeSpentData(formattedData);
      const totalTimeSpent = formattedData.reduce(
        (sum, item) => sum + item.average_time_spent,
        0
      );
      setTotalTimeSpent(totalTimeSpent);
    } catch (error) {
      console.error("Error fetching bot metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get last 7 days in correct order
  const getLast7Days = () => {
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const todayIndex = new Date().getDay();
    return [...Array(7)].map(
      (_, i) => daysOfWeek[(todayIndex - 6 + i + 7) % 7]
    );
  };

  const COLORS = ["#4CAF50", "#2196F3", "#FFC107", "#F44336"];

  // Fetch data on component mount or when selectedBot changes
  useEffect(() => {
    fetchConversationData();
    fetchSatisfactionData();
  }, [selectedBot?.id]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6">
      {loading && <Loader />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Performance Metrics
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Conversations Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Weekly Conversations
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
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
            Average Time Spent on Bot (Weekly)
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSpentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                />
                <YAxis
                  label={{
                    value: "Minutes",
                    angle: -90,
                    position: "insideLeft",
                  }}
                />
                <Tooltip />
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
            User Satisfaction
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Detailed Metrics
          </h2>
          <div className="overflow-x-auto">
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
                    metric: "Total Conversations",
                    value: "",
                  },
                  {
                    metric: "Avg. Session Duration (Last 7 days)",
                    value: `${totalTimeSpent} min`,
                  },
                  // {
                  //   metric: "Bounce Rate",
                  //   value: "32%",
                  //   change: "-5%",
                  //   positive: true,
                  // },
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
        </div>
      </div>
    </div>
  );
};
