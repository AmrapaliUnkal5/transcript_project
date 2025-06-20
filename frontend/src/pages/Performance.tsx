

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
import { DislikedQA } from "../services/api";
import { toast } from "react-toastify";


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

interface QuestionsTabContentProps {
  questions: string[];
  title: string;
}

interface UnansweredQuestions {
  questions: { original_text: string }[];
}

const COLOR_MAP: Record<string, string> = {
  Likes: "#4CAF50",      // green
  Dislikes: "#F44336",   // red
  Neutral: "#42A5F5",    // blue
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

  const [allQuestions, setAllQuestions] = useState<{questions: string[], count: number} | null>(null);
  const [questionsTabOpen, setQuestionsTabOpen] = useState(false);


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
  const [dislikedQA, setDislikedQA] = useState<DislikedQA[]>([]);

  const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestions | null>(null);

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
      // Set disliked Q&A
      setDislikedQA(response.disliked_qa || []);

      const total = likes + dislikes + neutral;

      let updatedData = [];

      if (total === 0) {
        updatedData = [{ name: "Neutral", value: 100 }];
      } else {
        const likePercent = Math.floor((likes / total) * 100);
        const dislikePercent = Math.floor((dislikes / total) * 100);
        const neutralPercent = 100 - likePercent - dislikePercent; // ensures exact 100%

        if (likes > 0) updatedData.push({ name: "Likes", value: likePercent });
        if (dislikes > 0) updatedData.push({ name: "Dislikes", value: dislikePercent });
        if (neutral > 0 || updatedData.length < 3) updatedData.push({ name: "Neutral", value: neutralPercent });
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
const viewDislikedQA = (qaList: DislikedQA[]): void => {
  // Convert Q&A to plain text
    const textContent = qaList
      .map((item, index) => `Q${index + 1}: ${item.question}\nA${index + 1}: ${item.answer}\n`)
      .join('\n');

    // Create a Blob URL for .txt content
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    // HTML layout with download link to the right
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Disliked Questions</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: #f5f5f5;
              font-size: 12px;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #eee;
            }
            h1 {
              color: #333;
              margin: 0;
            }
            .download-btn {
              background-color: #5348CB;
              color: white;
              border: none;
              padding: 8px 16px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              text-decoration: none;
            }
            .download-btn:hover {
              background-color: #4338ca;
            }
            .qa-block {
              margin-bottom: 30px;
            }
            .qa-question {
              font-weight: bold;
              font-size: 12px;
              color: #333;
              margin-bottom: 5px;
            }
            .qa-answer {
              margin-left: 20px;
              background: #f9f9f9;
              padding: 15px;
              border-left: 4px solid #5348CB;
              border-radius: 4px;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Disliked Questions & Answers</h1>
              <a href="${url}" download="disliked_questions.txt" class="download-btn">Download</a>
            </div>

            ${qaList.map((item, index) => `
              <div class="qa-block">
                <div class="qa-question">Q${index + 1}: ${item.question}</div>
                <div class="qa-answer">${item.answer}</div>
              </div>
            `).join('')}
          </div>

          <script>
            window.addEventListener('unload', function() {
              URL.revokeObjectURL('${url}');
            });
          </script>
        </body>
      </html>
    `;

    // Open the rendered page in a new window
    const newWindow = window.open("", "_blank");
    if (newWindow) {
      newWindow.document.write(html);
      newWindow.document.close();
    }
  };

  const [billingCycleMetrics, setBillingCycleMetrics] = useState({
    totalSessions: 0,
    totalUserMessages: 0,
    totalLikes: 0,
    totalDislikes: 0,
    totalChatDuration: "0h 0m 0s",
    uniqueSessionIds: 0,
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
        uniqueSessionIds: response.unique_session_ids,
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

<span
  style={{
    color:
      displayName === "Positive"
        ? "#51B13A"
        : displayName === "Negative"
        ? "#E35858"
        : "#42A5F5", // Neutral color
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

const fetchUnansweredQuestions = async () => {
  if (!selectedBot?.id) return;

  try {
    setLoading(true);
    const response = await authApi.getUnansweredQuestions({
      bot_id: selectedBot.id,
    });
    setUnansweredQuestions(response);
  } catch (error) {
    console.error('Error fetching unanswered questions:', error);
    toast.error('Failed to fetch unanswered questions');
  } finally {
    setLoading(false);
  }
};

// Modify your existing fetchAllQuestions function to also fetch unanswered questions
const fetchAllQuestions = async () => {
  if (!selectedBot?.id) return;

  try {
    setLoading(true);
    const [allQuestionsResponse, unansweredResponse] = await Promise.all([
      authApi.getBotQuestions({
        bot_id: selectedBot.id,
      }),
      authApi.getUnansweredQuestions({
        bot_id: selectedBot.id,
      })
    ]);
    setAllQuestions(allQuestionsResponse);
    setUnansweredQuestions(unansweredResponse);
    setQuestionsTabOpen(true);
  } catch (error) {
    console.error('Error fetching questions:', error);
    toast.error('Failed to fetch questions');
  } finally {
    setLoading(false);
  }
};

const renderQuestionsTab = (allQuestions: {questions: string[], count: number} | null, unansweredQuestions: {questions: {original_text: string}[]} | null) => {
  if (!allQuestions && !unansweredQuestions) return null;

  // Helper function to render questions as HTML string
  const renderQuestionsHTML = (questions: any[], title: string) => {
    return `
      <div class="question-list">
        
        ${questions.map((q, i) => `
          <div class="question-item" key="${i}">
            ${i + 1}. ${typeof q === 'string' ? q : q.original_text}
          </div>
        `).join('')}
      </div>
    `;
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Questions Asked By User</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
            padding-bottom: 10px;
          }
          h1 {
            color: #333;
            margin: 0;
          }
          .tabs {
            display: flex;
            margin-bottom: 20px;
            border-bottom: 1px solid #ddd;
          }
          .tab {
            padding: 10px 20px;
            cursor: pointer;
            border-bottom: 2px solid transparent;
          }
          .tab.active {
            border-bottom: 2px solid #5348CB;
            color: #5348CB;
            font-weight: bold;
          }
          .download-btn {
            background-color: #5348CB;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            text-decoration: none;
          }
          .download-btn:hover {
            background-color: #4338ca;
          }
          .question-list {
            margin-top: 20px;
          }
          .question-item {
            background: #f9f9f9;
            padding: 10px 15px;
            border-radius: 4px;
            border-bottom: 1px solid #eee;
            border-left: 2px solid #5348CB;
            margin-bottom: 10px;
          }
          .count {
            font-weight: bold;
            margin-bottom: 10px;
            color: #666;
          }
          .tab-content {
            display: none;
          }
          .tab-content.active {
            display: block;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="tabs">
            <div class="tab active" onclick="switchTab('all')">All Questions</div>
            <div class="tab" onclick="switchTab('unanswered')">Unanswered Questions</div>
          </div>
          
          <div class="header">
            <h1 id="titleHeader">List Of All The Questions Asked By User</h1>
            <a id="downloadBtn" href="#" class="download-btn">Download</a>
          </div>
          
          <div id="all-questions" class="tab-content active">
            ${allQuestions ? renderQuestionsHTML(allQuestions.questions, 'Questions') : '<p>No questions found</p>'}
          </div>
          
          <div id="unanswered-questions" class="tab-content">
            ${unansweredQuestions ? renderQuestionsHTML(unansweredQuestions.questions, 'Unanswered Questions') : '<p>No unanswered questions found</p>'}
          </div>
        </div>
        
        <script>
          function switchTab(tabName) {
            // Update tabs
            document.querySelectorAll('.tab').forEach(tab => {
              tab.classList.remove('active');
            });
            document.querySelector(\`.tab[onclick="switchTab('\${tabName}')"]\`).classList.add('active');
            
            // Update content
            document.querySelectorAll('.tab-content').forEach(content => {
              content.classList.remove('active');
            });
            document.getElementById(\`\${tabName}-questions\`).classList.add('active');
            
            // Update title
            const titleHeader = document.getElementById('titleHeader');
            if (tabName === 'all') {
              titleHeader.textContent = 'List Of All The Questions Asked By User';
            } else {
              titleHeader.textContent = 'List Of All The Unanswered Questions';
            }
            
            // Update download link
            updateDownloadLink(tabName);
          }
          
          function updateDownloadLink(tabName) {
            const questions = tabName === 'all' 
              ? ${JSON.stringify(allQuestions?.questions || [])} 
              : ${JSON.stringify(unansweredQuestions?.questions.map(q => q.original_text) || [])};
              
            const blob = new Blob([questions.map((q, i) => \`\${i + 1}. \${q}\`).join('\\n')], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const downloadBtn = document.getElementById('downloadBtn');
            downloadBtn.href = url;
            downloadBtn.download = \`\${tabName}_questions.txt\`;
          }
          
          // Initialize download link for first tab
          updateDownloadLink('all');
        </script>
      </body>
    </html>
  `;
  
  const newWindow = window.open("", "_blank");
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
};
useEffect(() => {
  if (questionsTabOpen && (allQuestions || unansweredQuestions)) {
    renderQuestionsTab(allQuestions, unansweredQuestions);
  }
}, [questionsTabOpen, allQuestions, unansweredQuestions]);


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

          <div  className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
    Daily Average Chat Duration – Last 7 Days
  </h2>
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
            {dislikedQA.length > 0 && (
  <button
    onClick={() => viewDislikedQA(dislikedQA)}
    className="text-blue-600 hover:underline mt-2"
  >
    View Disliked Questions
  </button>
)}
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
                    {
                      metric: "Unique Users Count", // new row
                     value: billingCycleMetrics.uniqueSessionIds.toLocaleString(),
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
        Frequently Asked Questions by User
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

<div className="relative mt-6 w-full">
  {/* Centered View More/Less button (only shown if more than 5 FAQs) */}
  {faqData.length > 5 && (
    <div className="absolute left-1/2 transform -translate-x-1/2">
      <button
        onClick={() => setShowAllFAQs(!showAllFAQs)}
        className="flex items-center justify-center gap-2 border border-[#5348CB] rounded-[12px] min-w-[102px] w-[153px] h-[48px] font-semibold text-[16px] text-[#5348CB] font-['Instrument_Sans']"
      >
        <img
          src="/images/dummy/view-more.png"
          alt="icon"
          className="w-4 h-4"
        />
        {showAllFAQs ? "View Less" : "View More"}
      </button>
    </div>
  )}

  {/* Right-aligned View All Questions (always shown if FAQs exist) */}
  {faqData.length > 0 && (
    <div className="flex justify-end">
      <span
        onClick={fetchAllQuestions}
        className="flex items-center gap-2 text-[#5348CB] text-[16px] font-semibold font-['Instrument_Sans'] cursor-pointer"
      >
        View All Questions
      </span>
    </div>
  )}
</div>
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