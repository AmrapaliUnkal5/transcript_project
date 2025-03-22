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

  useEffect(() => {
    const fetchSatisfactionData = async () => {
      try {
        if (!selectedBot?.id) {
          console.error("Bot ID is missing.");
          return;
        }
        setLoading(true);
        const response = await authApi.fetchBotMetrics(selectedBot.id);
        const { likes, dislikes, neutral } = response.reactions;
        console.log("response.reactions", response.reactions);
        const updatedData = [];

        // ✅ Only add "Likes" if there are any
        if (likes > 0) {
          updatedData.push({ name: "Likes", value: likes });
        }

        // ✅ Only add "Dislikes" if there are any
        if (dislikes > 0) {
          updatedData.push({ name: "Dislikes", value: dislikes });
        }

        // ✅ If both Likes & Dislikes are zero, show 100% Neutral
        if (updatedData.length === 0) {
          updatedData.push({ name: "Neutral", value: 100 });
        } else {
          // Otherwise, add neutral only if it is nonzero
          if (neutral > 0) {
            updatedData.push({ name: "Neutral", value: neutral });
          }
        }

        // ✅ Update state with filtered data
        setSatisfactionData(updatedData);

        const apiData = response.average_time_spent;

        // Get last 7 days in correct order
        const orderedDays = getLast7Days();

        // Map API data to correct days, filling missing values with 0
        const formattedData = orderedDays.map((day) => {
          const found = apiData.find((item) => item.day === day);
          return {
            day,
            average_time_spent: found ? found.average_time_spent : 0,
          };
        });

        setTimeSpentData(formattedData);
      } catch (error) {
        console.error("Error fetching bot metrics:", error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedBot) {
      fetchSatisfactionData();
    }
  }, [selectedBot]);

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
    const todayIndex = new Date().getDay(); // Get today's index (0 = Sunday, 6 = Saturday)

    // Generate last 7 days dynamically
    return [...Array(7)].map(
      (_, i) => daysOfWeek[(todayIndex - 6 + i + 7) % 7]
    );
  };

  const conversationData = [
    { month: "Jan", conversations: 1200 },
    { month: "Feb", conversations: 1900 },
    { month: "Mar", conversations: 1500 },
    { month: "Apr", conversations: 2100 },
    { month: "May", conversations: 2400 },
    { month: "Jun", conversations: 1800 },
  ];

  // const responseTimeData = [
  //   { time: "00:00", avg: 2.5 },
  //   { time: "04:00", avg: 1.8 },
  //   { time: "08:00", avg: 3.2 },
  //   { time: "12:00", avg: 2.9 },
  //   { time: "16:00", avg: 3.8 },
  //   { time: "20:00", avg: 2.1 },
  // ];

  // const satisfactionData = [
  //   { name: "Very Satisfied", value: 540 },
  //   { name: "Satisfied", value: 320 },
  //   { name: "Neutral", value: 120 },
  //   { name: "Dissatisfied", value: 20 },
  // ];

  const COLORS = ["#4CAF50", "#2196F3", "#FFC107", "#F44336"];

  return (
    <div className="space-y-6">
      {loading && <Loader />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Performance Metrics
        </h1>
        <button className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversations Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Monthly Conversations
          </h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conversationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="conversations"
                  fill="#2196F3"
                  name="Total Conversations"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Response Time Chart */}
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
                  interval={0} // Ensure all labels are shown
                  angle={-20} // Rotate labels to prevent overlap
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

        {/* Metrics Table */}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  {
                    metric: "Total Users",
                    value: "12,345",
                    change: "+12%",
                    positive: true,
                  },
                  {
                    metric: "Avg. Session Duration",
                    value: "5m 23s",
                    change: "+8%",
                    positive: true,
                  },
                  {
                    metric: "Bounce Rate",
                    value: "32%",
                    change: "-5%",
                    positive: true,
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
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm ${
                        item.positive
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {item.change}
                    </td>
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
