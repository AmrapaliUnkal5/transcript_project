import React from "react";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  AreaChart,
  Area,
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
import { useNavigate } from "react-router-dom";
import ReactWordcloud from 'react-wordcloud';


interface ConversationData {
  day: string;
  count: number;
}

interface FAQData {
  question: string;
  count: number;
  cluster_id: string;
}

interface WordCloudData {
  text: string;
  value: number;
}

const COLOR_MAP: Record<string, string> = {
  Likes: "#4CAF50",      // green
  Dislikes: "#F44336",   // red
  Neutral: "#FFC107",    // amber
};
const COLORS = ["#4CAF50", "#F44336", "#2196F3", "#FFC107", "#F44336"];

const UpgradeMessage = ({
  requiredPlan = "Starter",
  feature = "analytics",
}) => {
  return (
    <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600 shadow-lg w-64 text-center">
      <Lock className="w-8 h-4 mx-auto text-gray-400 mb-3" />
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {feature === "analytics" ? "Analytics Locked" : "Feature Locked"}
      </h3>
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
        {feature === "analytics"
          ? `Upgrade to ${requiredPlan} plan to view analytics.`
          : `Upgrade to ${requiredPlan} plan for detailed metrics.`}
      </p>
      <div className="flex justify-center">
        <a
          href="/dashboard/subscription"
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
  const navigate = useNavigate();

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
  //const [wordCloudData, setWordCloudData] = useState<{value: string, count: number}[]>([]);
  const [wordCloudData, setWordCloudData] = useState<WordCloudData[]>([]);




  const [openIndex, setOpenIndex] = useState<number | null>(null);

const handleToggle = (index: number) => {
  setOpenIndex(openIndex === index ? null : index);
};

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
      // days.push(`${dayName} `);
    }

    return days;
  };

  function formatToHourMinute(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours} hr ${minutes} min` : `${minutes} min`;
  }



const [activeFAQIndex, setActiveFAQIndex] = useState(null);
  const [showAllFAQs, setShowAllFAQs] = useState(false);

  const toggleFAQ = (index) => {
    setActiveFAQIndex(activeFAQIndex === index ? null : index);
  };

  const visibleFAQs = showAllFAQs ? faqData : faqData.slice(0, 5);






  
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

      const formattedData = orderedDays.map((formattedDay) => {
      // Extract just the day name from the formatted string to match with API data
      const dayName = formattedDay.split(' ')[0];
      const fullDay = fullDayMap[dayName as keyof typeof fullDayMap];
      return {
        day: formattedDay, // Now using the full formatted string
        average_time_spent:
          apiData.find((item) => item.day === fullDay)?.average_time_spent || 0,
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



  const renderCustomLegend = () => (
  <div className="flex justify-center items-center space-x-2 m-3">
    <div
      style={{
        width: 12,
        height: 12,
        backgroundColor: "#4CAF50", // same as stroke color
        borderRadius: 2,
      }}
    />
    <span className="text-gray-700 dark:text-gray-200 text-sm">
      Avg Time Spent
    </span>
  </div>
);
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


// const renderCustomLegend2 = (props: any) => {
//   const { payload } = props;

//   return (
//     <div className="flex justify-center gap-8 mt-4">
//       {payload.map((entry: any, index: number) => (
//         <div key={`item-${index}`} className="flex items-center space-x-2">
//           <div
//             className="w-3 h-3 rounded"
//             style={{ backgroundColor: entry.color }}
//           ></div>
//           <span className="text-sm font-medium text-gray-800 dark:text-white">
//             {entry.value} ({(entry.payload.percent * 100).toFixed(0)}%)
//           </span>
//         </div>
//       ))}
//     </div>
//   );
// };

const renderCustomLegend2 = (props: any) => {
  const { payload } = props;

  return (
    <div className="flex justify-center gap-8 mt-4">
      {payload.map((entry: any, index: number) => {
        // Use entry.payload.name instead of entry.value
        const rawName = entry.payload.name;
        const displayName =
          rawName === "Likes" ? "Positive" :
          rawName === "Dislikes" ? "Negative" :
          rawName;

        // entry.payload.percent if you have percent on payload
        const percent =
          entry.payload.percent != null
            ? entry.payload.percent * 100
            : ((entry.payload.value / 
               payload.reduce((sum, e) => sum + e.payload.value, 0)) * 100);

        return (
          <div key={`item-${index}`} className="flex items-center space-x-2 ">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
           
            {/* <span className="" >
    {displayName}
    {displayName === "Positive" && ` (${percent.toFixed(0)}%)`}
  </span> */}


  <span
  style={{
    color: displayName === "Positive" ? "#51B13A" : "#E35858",
    fontSize: "15px",
    fontFamily: "Instrument Sans, sans-serif",
    fontWeight: 500,
  }}
>
  {displayName} ({percent.toFixed(0)}%)
</span>
          </div>
        );
      })}
    </div>
  );
};



 const getLast7Days = () => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    const dayNumber = date.getDate();
    return `${dayName} ${monthName} ${dayNumber}`;
  });
};


  

  const fetchWordCloudData = async () => {
  if (!selectedBot?.id) return;

  try {
    setLoading(true);
    const response = await authApi.getWordCloud({
      bot_id: selectedBot.id,
    });
    setWordCloudData(response.words || []);
  } catch (error) {
    console.error("Error fetching word cloud data:", error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
  if (!selectedBot?.id || !userPlan) return; // Early return if no userPlan
  
  // Basic analytics for all paid plans (Plan 2+)
  if (userPlan.id > 1) {
    fetchConversationData();
    fetchSatisfactionData();
  }
  
  // Advanced analytics only for professional plans (Plan 3+)
  if (userPlan.id >= 4) {
    fetchFaqData();
    fetchWordCloudData();
  }
  
  // Billing metrics for plans 2+
  if (userPlan.id >= 4) {
    fetchBillingCycleMetrics();
  }
}, [selectedBot?.id, userPlan?.id]); // Add userPlan?.id to dependency array

  if (loading) {
    return <Loader />;
  }

  if (!selectedBot) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="text-gray-500 dark:text-white text-lg">
          No bot selected.
        </div>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go to Home
        </button>
      </div>




    );
  }




  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        {/* <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Analytics : {selectedBot.name}
        </h1> */}
        <h1
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "24px",
    color: "#333333",
    fontWeight: "bold",
  }}
>
  Analytics : {selectedBot.name}
</h1>
</div>






      <div className="relative">
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${
            hasNoAnalyticsAccess ? "filter blur-xl pointer-events-none" : ""
          }`}
        >
          {/* Weekly Conversations Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
           User Messages Trend – Last 7 Days
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={conversationData}>
                   <CartesianGrid stroke="#E0E0E0" strokeOpacity={0.6} strokeDasharray="3 3" />
                  <XAxis
                    dataKey="day"
                    angle={-40}
                    textAnchor="end"
                    height={100}
                    tick={{ fill: '#1a1a1a' }}
                  />
                  <YAxis domain={[0, "dataMax + 1"]} allowDecimals={false}  tick={{ fill: '#1a1a1a' }}/>
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill="#615FE4"
                    name="Total Conversations"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Average Time Spent Chart */}
          {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
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
          </div> */}


          <div  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
    Daily Average Chat Duration – Last 7 Days
  </h2>
  {/* <div className="h-80">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={timeSpentData}>
        <CartesianGrid stroke="#E0E0E0" strokeOpacity={0.6} strokeDasharray="3 3" />
        <XAxis dataKey="day" angle={-20} textAnchor="end" tick={{ fill: '#1a1a1a' }} />
        <YAxis
          label={{
            value: "Minutes",
            angle: -90,
            position: "insideLeft",
            fontsize:10,
            fill: '#666666', 
            }}
            tick={{ fill: '#1a1a1a' }}
        />
        <Tooltip
          formatter={(value: number) => [
            `${value} min`,
            "Avg Time Spent",
          ]}
        />
       
        <Legend content={renderCustomLegend} />

        <Area
          type="monotone"
          dataKey="average_time_spent"
          stroke="#4CAF50"
          fill="#81C784" 
          name="Avg Time Spent (s)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div> */}

  <div className="h-80 ">
  <ResponsiveContainer width="100%" height="100%">
    <AreaChart data={timeSpentData} >
      <CartesianGrid stroke="#E0E0E0" strokeOpacity={0.6} strokeDasharray="3 3" />
      <XAxis dataKey="day" angle={-40} textAnchor="end" tick={{ fill: '#1a1a1a' }} height={60} interval={0} scale="point" />
      <YAxis
        label={{
          value: "Minutes",
          angle: -90,
          position: "insideLeft",
          fontSize: 10,
          fill: '#666666',
        }}
        tick={{ fill: '#1a1a1a' }}
      />
      <Tooltip
        formatter={(value: number) => [`${value} min`, "Avg Time Spent"]}
      />
      <Legend content={renderCustomLegend} />
      <Area
        type="linear"
        dataKey="average_time_spent"
        stroke="#4CAF50"
        fill="rgba(129, 199, 132, 0.2)"  // Light green shade with transparency
        name="Avg Time Spent (s)"
      />
    </AreaChart>
  </ResponsiveContainer>
</div>

</div>

          {/* User Satisfaction Chart */}
          <div  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
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
                  
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {satisfactionData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLOR_MAP[entry.name] || "#ccc"}
                      />
                    ))}
                  </Pie>
                  {/* <Tooltip /> */}
                  {/* <Legend /> */}
                  <Legend content={renderCustomLegend2} />

                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Metrics Table */}
          <div   className="relative bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }} >
            <h2 className=" mb-4"  
              style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "18px",
    fontWeight: 600,
    color: "#333333",
  }}>
            Current Billing Cycle Metrics
            </h2>
            <div
              className={`overflow-x-auto  ${
                !hasAdvancedAnalytics ? "filter blur-xl" : ""
              }`}
            >
             <table
   className="w-full"
  
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px',
     borderCollapse: 'separate', // <- important!
    overflow: 'hidden' 
  }} 
>

                <thead>
                  <tr className=" border border-red-500"  style={{ backgroundColor: "#EFF0FF",height: "57px"}}>
                    <th className="px-6 py-3 0 text-left " style={{   lineHeight:'24px',fontFamily: "Instrument Sans, sans-serif",fontSize: "16px",fontWeight: 600,color: "#333333"}}>
                      Metric
                    </th>
                    <th className="px-6 py-3 text-left " style={{   lineHeight:'24px',fontFamily: "Instrument Sans, sans-serif",fontSize: "16px",fontWeight: 600,color: "#333333"}}>
                      Value
                    </th>
                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Change
                    </th> */}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-100 ">
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
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 " style={{   lineHeight:'26px',fontFamily: "Instrument Sans, sans-serif",fontSize: "16px",fontWeight: 400,color: "#333333"}}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white" style={{
      lineHeight: '26px',
      fontFamily: "Instrument Sans, sans-serif",
      fontSize: "14px",
      fontWeight: 400,
      color: "#333333",
    }}>
                        {item.metric}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400" style={{
      lineHeight: '26px',
      fontFamily: "Instrument Sans, sans-serif",
      fontSize: "14px",
      fontWeight: 400,
      color: "#333333",
    }}>
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
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <UpgradeMessage
                  requiredPlan="Professional"
                  feature=" detailed analytics"
                />
              </div>
            )}
          </div>
          {/* FAQ Analytics Chart */}

          {/* <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-[420px]">
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
                    
                    </div>
                  ))}
                 
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
          </div> */}

          </div>
          <div className="relative w-full ">
          <div className={`flex flex-col w-full gap-6 ${
            hasNoAnalyticsAccess ? "filter blur-xl pointer-events-none" : ""
          }`}>

 <div  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-4"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
      <h2
        className="text-lg font-semibold text-gray-900 dark:text-white mb-4"
        style={{ fontFamily: "Instrument Sans", fontWeight: 600 }}
      >
        Frequently Asked Questions by Users
      </h2>

      <div
        className={`space-y-3 overflow-y-auto ${
          !showAllFAQs ? "max-h-[350px]" : ""
        } ${!hasAdvancedAnalytics ? "filter blur-xl" : ""}`}
      >
        {visibleFAQs.map((faq, index) => (
          <div
            key={index}
            className="border border-gray-300 rounded-lg p-4"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full text-left flex justify-between items-center font-semibold text-gray-900 dark:text-white transition-colors hover:text-blue-600"
            >
              <span>{`Question ${index + 1}`}</span>
              <svg
                className={`w-5 h-5 transform transition-transform duration-200 ${
                  activeFAQIndex === index ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {activeFAQIndex === index && (
              <div className="mt-2 text-sm text-gray-700 dark:text-gray-300 pl-4">
                {faq.question || "No additional information available."}
              </div>
            )}
          </div>
        ))}

      {faqData.length > 5 && (
        // <div className="flex justify-center mt-6">
        //   <button
        //     onClick={() => setShowAllFAQs(!showAllFAQs)}
        //     className="text-[#5348CB] font-medium underline hover:no-underline"
        //   >
        //     {showAllFAQs ? "View Less" : "View More"}
        //   </button>
        // </div>

        <div className="flex justify-center mt-6">
  <button
    onClick={() => setShowAllFAQs(!showAllFAQs)}
    className="flex items-center justify-center gap-2 border border-[#5348CB] rounded-[12px] min-w-[102px] w-[153px] h-[48px] font-semibold text-[16px] text-[#5348CB] font-['Instrument_Sans']"
  >
    <img
      src="/images/dummy/view-more.png" // Replace with your actual image path
      alt="icon"
      className="w-4 h-4"
    />
    {showAllFAQs ? "View Less" : "View More"}
  </button>
</div>

      )}

      {/* {!hasAdvancedAnalytics && (
        <div className="absolute top-[85%] left-[25%] transform -translate-x-1/2 -translate-y-1/2 z-10">
          <UpgradeMessage
            requiredPlan="Professional"
            feature="FAQ analytics"
          />
        </div>
      )} */}
    </div>
</div>
        {/* Word Cloud Chart - 6th graph */}
          <div  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Word Cloud
            </h2>
            <div
              className={`h-[calc(100%-40px)] overflow-y-auto ${
                !hasAdvancedAnalytics ? "filter blur-xl" : ""
              }`}
            >
    {wordCloudData.length > 0 ? (
      <ReactWordcloud
        words={wordCloudData}
        options={{
          rotations: 2,
          rotationAngles: [-45, 0],
          fontSizes: [12, 60],
          deterministic: true,
        }}
      />
              
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    No word cloud data available yet
                  </p>
                </div>
              )}
            </div>
            {!hasAdvancedAnalytics && (
              <div className="absolute top-[55%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                <UpgradeMessage
                  requiredPlan="Professional"
                  feature="word cloud analytics"
                />
              </div>
            )}
          </div>
          </div>
    </div>

        {hasNoAnalyticsAccess && (
          <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
            <UpgradeMessage requiredPlan="Starter" feature="analytics" />
          </div>
        )}
      </div>
    </div>
  );
};