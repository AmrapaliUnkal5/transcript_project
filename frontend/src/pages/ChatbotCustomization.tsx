import React, { useState, useEffect, useRef } from "react";
import {
  Type,
  Move,
  MessageSquare,
  Palette,
  Sliders,
  X,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { BotSettings } from "../types";
import { authApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../index.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useBot } from "../context/BotContext";
import { useLoader } from "../context/LoaderContext";
import Loader from "../components/Loader";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useSubscriptionPlans } from "../context/SubscriptionPlanContext";
import { Theme , THEMES } from '../types/index'; 
import { Info } from "lucide-react";


interface MessageUsage {
  totalUsed: number;
  basePlan: {
    limit: number;
    used: number;
    remaining: number;
  };
  addons: {
    totalLimit: number;
    used: number;
    remaining: number;
    items: Array<{
      addon_id: number;
      name: string;
      limit: number;
      remaining: number;
    }>;
  };
  effectiveRemaining: number;
}


const saveBotSettings = async (
  settings: BotSettings,
  userId: number,
  setLoading: (loading: boolean) => void
) => {
  setLoading(true);
  console.log("userId", userId);
  const data = {
    user_id: userId,
    bot_name: settings.name,
    font_style: settings.fontStyle,
    font_size: parseInt(settings.fontSize),
    position: settings.position,
    bot_color: settings.botColor,
    user_color: settings.userColor,
    max_words_per_message: settings.maxMessageLength,
    is_active: true,
    appearance: settings.appearance,
    temperature: settings.temperature,
    window_bg_color: settings.windowBgColor,
    welcome_message: settings.welcomeMessage,
    input_bg_color: settings.inputBgColor,
    // Add new customization fields
    header_bg_color: settings.headerBgColor,
    header_text_color: settings.headerTextColor,
    chat_text_color: settings.chatTextColor,
    user_text_color: settings.userTextColor,
    button_color: settings.buttonColor,
    button_text_color: settings.buttonTextColor,
    timestamp_color: settings.timestampColor,
    user_timestamp_color: settings.userTimestampColor,
    border_radius: settings.borderRadius,
    border_color: settings.borderColor,
    chat_font_family: settings.chatFontFamily,
    lead_generation_enabled: settings.lead_generation_enabled,
    lead_form_config: settings.lead_form_config,
    show_sources: settings.showSources, 
    unanswered_msg: settings.unansweredMsg,
  };

  try {
    setLoading(true);
    const response = await authApi.saveBotSettings(data);
    console.log("Full response:", response);
    console.log("Settings saved successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  } finally {
    setLoading(false);
  }
};

const updateBotSettings = async (
  botId: number,
  UserId: number,
  settings: BotSettings,
  setLoading: (loading: boolean) => void
) => {
  setLoading(true);
  const data = {
    user_id: UserId,
    bot_name: settings.name,
    font_style: settings.fontStyle,
    font_size: parseInt(settings.fontSize),
    position: settings.position,
    bot_color: settings.botColor,
    user_color: settings.userColor,
    max_words_per_message: settings.maxMessageLength,
    is_active: true,
    appearance: settings.appearance,
    temperature: settings.temperature,
    window_bg_color: settings.windowBgColor,
    welcome_message: settings.welcomeMessage,
    input_bg_color: settings.inputBgColor,
    // Add new customization fields
    header_bg_color: settings.headerBgColor,
    header_text_color: settings.headerTextColor,
    chat_text_color: settings.chatTextColor,
    user_text_color: settings.userTextColor,
    button_color: settings.buttonColor,
    button_text_color: settings.buttonTextColor,
    timestamp_color: settings.timestampColor,
    border_radius: settings.borderRadius,
    border_color: settings.borderColor,
    chat_font_family: settings.chatFontFamily,
    lead_generation_enabled: settings.lead_generation_enabled,
    lead_form_config: settings.lead_form_config,
    show_sources: settings.showSources, 
    unanswered_msg: settings.unansweredMsg,
  };

  try {
    console.log("settings.temperature", settings.temperature);
    console.log("settings.appearance", settings.appearance);
    const response = await authApi.updateBotSettings(botId, data);
    console.log("settings.botColor", settings.botColor);
    console.log("settings.user_color", settings.userColor);
    console.log("Settings updated successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to update settings:", error);
    throw error;
  } finally {
    setLoading(false);
  }
};

export interface BotSettings {
  name: string;
  icon: string;
  fontSize: string;
  fontStyle: string;
  position: string;
  maxMessageLength: number;
  botColor: string;
  userColor: string;
  appearance: string;
  temperature: number;
  windowBgColor: string;
  welcomeMessage: string;
  inputBgColor: string;
  // New customization fields
  headerBgColor: string;
  headerTextColor: string;
  chatTextColor: string;
  userTextColor: string;
  buttonColor: string;
  buttonTextColor: string;
  timestampColor: string;
  borderRadius: string;
  borderColor: string;
  chatFontFamily: string;
  userTimestampColor: string;
  lead_generation_enabled: boolean;
  lead_form_config?: Array<{field: "name" | "email" | "phone" | "address";required: boolean;}>;
  showSources: boolean; 
  unansweredMsg: string;
}

export const ChatbotCustomization = () => {
  const { loading, setLoading } = useLoader();
  const { user, refreshUserData } = useAuth();
  //const [botToDelete, setBotToDelete] = useState<string | null>(null);
  const userId = user?.user_id;
  const navigate = useNavigate();
  const { selectedBot, setSelectedBot } = useBot(); // Get setSelectedBot from context
  if (!userId) {
    //alert("User ID is missing. Please log in again.");
  }

  const [interactionId, setInteractionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<
    {
      sender: string;
      text: string;
      message_id?: number;
      reaction?: "like" | "dislike";
      is_greeting?: boolean; 
      sources?: Array<{  // Add sources to the message object
      file_name: string;
      source: string;
      content_preview: string;
      website_url: string;
      url: string;
    }>;
    showSources?: boolean;  // Add flag to control visibility
  }[]
  >([]);

  const [inputMessage, setInputMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [currentBotMessage, setCurrentBotMessage] = useState("");
  const [fullBotMessage, setFullBotMessage] = useState("");
  const [botMessageId, setBotMessageId] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<Date | null>(null);
  const idleTimeoutRef = useRef<number | null>(null);
  const sessionExpiryRef = useRef<number | null>(null);
  const interactionIdRef = useRef(interactionId);
  const [reactionGiven, setReactionGiven] = useState(false);
  const [reaction, setReaction] = useState<"like" | "dislike" | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const { plans, addons, getPlanById } = useSubscriptionPlans();
  //const [planLimit, setPlanLimit] = useState(0);
  const [pendingAddonMessages, setPendingAddonMessages] = useState(0);
  const userPlanId = user?.subscription_plan_id || 1;
  const userPlan = getPlanById(userPlanId);
  const userAddonIds = user?.addon_plan_ids || [];
  // const [showSources, setShowSources] = useState(false);
  const userActiveAddons = addons
    ? addons.filter((addon) => userAddonIds.includes(addon.id))
    : [];

  // Calculate effective message limits
  const baseMessageLimit = userPlan?.message_limit || 0;
  // Count each addon purchase separately
  const addonMessageLimit = userAddonIds.reduce((sum, addonId) => {
    const addon = addons?.find((a) => a.id === addonId);
    return sum + (addon?.additional_message_limit || 0);
  }, 0);
  const totalMessageLimit = baseMessageLimit + addonMessageLimit;
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [leadAddress, setLeadAddress] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Track usage state
  const [messageUsage, setMessageUsage] = useState({
    totalUsed: 0,
    baseUsed: 0,
    baseRemaining: baseMessageLimit,
    addonUsed: 0,
    addonRemaining: addonMessageLimit,
    //effectiveRemaining: baseMessageLimit + addonMessageLimit,
    totalLimit: 0,
    remaining: 0,
    effectiveRemaining: 0,
    totaloveralllimit: 0,
    addonused: 0,
    addonremaining: 0,
    baseplanremaining: 0,
  });

  // Track which addons are being used
  const [addonUsage, setAddonUsage] = useState<Record<number, number>>({});

  const [settings, setSettings] = useState<BotSettings>({
    name: "Support Bot",
    icon: "/images/bot_1.png",
    fontSize: "12px",
    fontStyle: "Inter",
    position: "bottom-right",
    maxMessageLength: 200,
    botColor: "#cfcfcf",
    userColor: "#9e9e9e",
    appearance: "Popup",
    temperature: 0,
    windowBgColor: "#F9FAFB",
    welcomeMessage: "Hi there! How can I help you today?",
    inputBgColor: "#FFFFFF",
    // New customization defaults
    headerBgColor: "#292929",
    headerTextColor: "#efebeb",
    chatTextColor: "#1F2937",
    userTextColor: "#171616",
    buttonColor: "#0f0f0f",
    buttonTextColor: "#faf9f9",
    timestampColor: "#1F2937",
    userTimestampColor: "#FFFFFF",
    borderRadius: "12px",
    borderColor: "#0a0a0a",
    chatFontFamily: "Inter",
    lead_generation_enabled: false,
    lead_form_config: [{ field: "name", required: false },{ field: "phone", required: false },{ field: "email", required: false },{ field: "address", required: false }],
    showSources: false, 
    unansweredMsg: "I'm sorry, I don't have an answer for this question. This is outside my area of knowledge.Is there something else I can help with?",
  });

  const [isBotExisting, setIsBotExisting] = useState<boolean>(false);
  const [botId, setBotId] = useState<number | null>(null);
  const [waitingForBotResponse, setWaitingForBotResponse] = useState(false);
  const headerStyle: React.CSSProperties = {
    backgroundColor: settings.headerBgColor || "#007bff",
    color: settings.headerTextColor || "#fff",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderTopLeftRadius:
      settings.borderRadius === "rounded-full" ? "20px" : settings.borderRadius,
    borderTopRightRadius:
      settings.borderRadius === "rounded-full" ? "20px" : settings.borderRadius,
  };
  const [errors, setErrors] = useState<{ maxMessageLength?: string }>({});
  const MAX_USER_MESSAGE_LENGTH = 1000;
  const iconStyle: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    objectFit: "cover",
  };
  const [hasWhiteLabeling, setHasWhiteLabeling] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

const [selectedTheme, setSelectedTheme] = useState<string>('none');
const [showCustomize, setShowCustomize] = useState(false);

const [customizedThemes, setCustomizedThemes] = useState<Record<string, Partial<BotSettings>>>({});
const [selectedPredefinedIcon, setSelectedPredefinedIcon] = useState<string | null>(null);
const hasLeadFields = (settings?.lead_form_config  ?? []).length > 0;

  useEffect(() => {
    interactionIdRef.current = interactionId;
  }, [interactionId]);

  useEffect(() => {
    console.log("Unload move to another page");
    console.log("interactionId", interactionIdRef.current);
    // Attach event listeners
    // Attach event listeners
    const handleBeforeUnload = async () => {
      console.log("beforeunload event triggered");
      console.log("interactionId", interactionIdRef.current);
      await endChatSession(); // Call the session end function
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      endChatSession();
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages, isBotTyping]);

  useEffect(() => {
    const chat = chatContainerRef.current;
    if (!chat) return;

    const isAtBottom = chat.scrollHeight - chat.scrollTop === chat.clientHeight;

    if (isAtBottom) {
      chat.scrollTop = chat.scrollHeight;
    }
  }, [messages]);

  //check add ons // Check White-Labeling Addon
  useEffect(() => {
    const checkWhiteLabelingAddon = async () => {
      if (!selectedBot?.id) {
        console.error("Bot ID is missing.");
        return;
      }
      try {
        const responselabel = await authApi.checkWhiteLabelingAddon(
          selectedBot?.id
        );

        console.log("White-Labeling response", responselabel);
        setHasWhiteLabeling(responselabel.hasWhiteLabeling);
      } catch (error) {
        console.error("Error checking White-Labeling addon", error);
        setHasWhiteLabeling(false); // Default to false in case of error
      }
    };

    if (botId) {
      checkWhiteLabelingAddon();
    }
  }, [botId]); // Re-run if userId changes

  useEffect(() => {
    const fetchMessageData = async () => {
      try {
        const response = await authApi.getUserMessageCount();
        console.log("Message usage response:", response); // Debug log

        // Map the backend response to frontend state
        setMessageUsage({
          totalUsed: response.total_messages_used,
          basePlan: {
            limit: response.base_plan.limit,
            used: response.base_plan.used,
            remaining: response.base_plan.remaining,
          },
          addons: {
            totalLimit: response.addons.total_limit,
            used: response.addons.used,
            remaining: response.addons.remaining,
            items: response.addons.items || [],
          },
          effectiveRemaining: response.effective_remaining,
        });
      } catch (error) {
        console.error("Failed to fetch message data:", error);
        toast.error("Failed to load message usage data");
      }
    };
    if (user?.user_id) {
      fetchMessageData();
    }
  }, [user, getPlanById]);

  useEffect(() => {
    const fetchBotSettings = async () => {
      setLoading(true);
      try {
        if (!selectedBot?.id) {
          console.error("Bot ID is missing.");
          return;
        }
        const response = await authApi.getBotSettingsBotId(selectedBot.id);

        if (response) {
          setBotId(selectedBot.id);
          setIsBotExisting(true);

          // Set the selected theme from database
        setSelectedTheme(response.theme_id || 'none');

          setSettings({
            name: response.bot_name,
            icon: response.bot_icon || "/images/bot_1.png" ,
            fontSize: `${response.font_size}px`,
            fontStyle: response.font_style || settings.fontStyle,
            position: response.position || settings.position,
            maxMessageLength: response.max_words_per_message,
            botColor: response.bot_color || settings.botColor,
            userColor: response.user_color || settings.userColor,
            appearance: response.appearance || settings.appearance,
            temperature: response.temperature || settings.temperature,
            windowBgColor: response.window_bg_color || "#F9FAFB",
            welcomeMessage:
              response.welcome_message || "Hi there! How can I help you today?",
            inputBgColor: response.input_bg_color || "#FFFFFF",
            // Load the new customization fields
            headerBgColor: response.header_bg_color || "#3B82F6",
            headerTextColor: response.header_text_color || "#FFFFFF",
            chatTextColor: response.chat_text_color || "#1F2937",
            userTextColor: response.user_text_color || "#121111",
            buttonColor: response.button_color || "#3B82F6",
            buttonTextColor: response.button_text_color || "#FFFFFF",
            timestampColor: response.chat_text_color || "#1F2937", // Match chat text color
            userTimestampColor: response.user_text_color || "#121111",
            borderRadius: response.border_radius || "12px",
            borderColor: response.border_color || "#E5E7EB",
            chatFontFamily: response.chat_font_family || "Inter",
            lead_generation_enabled: response.lead_generation_enabled ?? false,
            lead_form_config: response.lead_form_config || [],
            showSources: response.show_sources ?? false,
            unansweredMsg: response.unanswered_msg || "I'm sorry, I don't have an answer for this question. This is outside my area of knowledge.Is there something else I can help with?",
          });
        }
      } catch (error) {
        console.error("Failed to fetch bot settings:", error);
      } finally {
        setLoading(false);
      }
    };

    if (selectedBot?.id) {
      fetchBotSettings();
    }
  }, [selectedBot, setLoading]);

  useEffect(() => {
    const fetchInitialUsage = async () => {
      try {
        const response = await authApi.getUserMessageCount();
        const baseUsed = response.base_plan.used;
        const addonUsed = response.addons.used;
        const totalLimit =
          response.addons.total_limit + response.base_plan.limit;

        setMessageUsage({
          totalUsed: baseUsed + addonUsed,
          baseUsed,
          baseRemaining: Math.max(0, baseMessageLimit - baseUsed),
          addonUsed,
          addonRemaining: Math.max(0, addonMessageLimit - addonUsed),
          //effectiveRemaining: Math.max(0, totalMessageLimit - (baseUsed + addonUsed)),
          totalLimit: response.addons.total_limit,
          remaining: response.addons.remaining,
          effectiveRemaining: response.effective_remaining,
          totaloveralllimit:
            response.addons.total_limit + response.base_plan.limit,
          addonused: response.addons.used,
          addonremaining: response.addons.remaining,
          baseplanremaining: response.base_plan.remaining,
        });

        // Initialize addon usage tracking
        if (response.addons.items) {
          const initialAddonUsage: Record<number, number> = {};
          response.addons.items.forEach((addon) => {
            initialAddonUsage[addon.addon_id] = addon.used || 0;
          });
          setAddonUsage(initialAddonUsage);
        }
      } catch (error) {
        console.error("Failed to fetch message usage:", error);
      }
    };

    if (user?.user_id) {
      fetchInitialUsage();
    }
  }, [user, baseMessageLimit, addonMessageLimit, totalMessageLimit]);

  // Check localStorage if no selected bot in state
  useEffect(() => {
    if (!selectedBot) {
      const savedBot = localStorage.getItem("selectedBot");
      if (savedBot) {
        try {
          const bot = JSON.parse(savedBot);
          setSelectedBot(bot); // Update context with the saved bot
        } catch (e) {
          console.error("Failed to parse saved bot", e);
          localStorage.removeItem("selectedBot");
          navigate("/"); // Redirect to home if invalid bot data
        }
      } else {
        navigate("/"); // Redirect to home if no bot found
      }
    }
  }, [selectedBot, setSelectedBot, navigate]);

useEffect(() => {
  // Update welcome message when it changes
  if (messages.length === 0 || 
      (messages.length > 0 && messages[0].sender === "bot" && messages[0].text !== settings.welcomeMessage)) {
    setMessages([{ sender: "bot", text: settings.welcomeMessage }]);
  }
}, [settings.welcomeMessage]);

  // In ChatbotCustomization.tsx
  const handleRefresh = async () => {
    try {
      await refreshUserData(); // Refresh user data from AuthContext
      const response = await authApi.getUserMessageCount();
      setMessageUsage({
        totalUsed: response.total_messages_used,
        basePlan: {
          limit: response.base_plan.limit,
          used: response.base_plan.used,
          remaining: response.base_plan.remaining,
        },
        addons: {
          totalLimit: response.addons.total_limit,
          used: response.addons.used,
          remaining: response.addons.remaining,
          items: response.addons.items || [],
        },
        effectiveRemaining: response.effective_remaining,
      });
      toast.success("Message data refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh message data:", error);
      toast.error("Failed to refresh message data");
    }
  };
  const updateMessageCount = () => {
    setMessageUsage((prev) => ({
      ...prev,
      totalUsed: prev.totalUsed + 1,
      effectiveRemaining: prev.effectiveRemaining - 1,
      // Update base or addon counts based on what backend returns
      baseUsed: prev.baseRemaining > 0 ? prev.baseUsed + 1 : prev.baseUsed,
      baseRemaining:
        prev.baseRemaining > 0 ? prev.baseRemaining - 1 : prev.baseRemaining,
      addonUsed: prev.baseRemaining <= 0 ? prev.addonUsed + 1 : prev.addonUsed,
      addonRemaining:
        prev.baseRemaining <= 0 ? prev.addonRemaining - 1 : prev.addonRemaining,
    }));
  };

  const handleUserActivity = () => {
    setLastActivityTime(new Date());
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

    idleTimeoutRef.current = setTimeout(() => {
      endChatSession();
    }, 60 * 60 * 1000);
  };

  const handleReaction = async (type: "like" | "dislike", index: number) => {
    const message = messages[index];
    const messageId = message?.message_id;
    if (!messageId || !interactionId || !userId || !botId) return;

    try {
      await authApi.submitReaction({
        interaction_id: interactionId,
        session_id: `${userId}-${index}`,
        bot_id: botId,
        reaction: type,
        message_id: messageId,
      });

      setMessages((prev) =>
        prev.map((msg, i) => {
          if (i !== index) return msg;
          return msg.reaction === type
            ? { ...msg, reaction: undefined }
            : { ...msg, reaction: type };
        })
      );
    } catch (error) {
      console.error("Failed to submit reaction:", error);
    }
  };

  const endChatSession = async () => {
    console.log("endChatSession");
    console.log("interactionId", interactionIdRef.current);
    if (!interactionIdRef.current) return;
    try {
      console.log(
        `Ending chat session ${
          interactionIdRef.current
        } at ${new Date().toISOString()}`
      );
      await authApi.endInteraction(interactionIdRef.current);
      console.log("Session successfully ended in the database");
    } catch (error) {
      console.error("Failed to end session:", error);
    } finally {
      setInteractionId(null);
      setMessages([{ sender: "bot", text: settings.welcomeMessage }]);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (sessionExpiryRef.current) clearTimeout(sessionExpiryRef.current);
    }
  };

  if (!selectedBot) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="text-gray-500 dark:text-white text-lg">
          No bot selected.
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go to Home
        </button>
      </div>
    );
  }

  const startChatSession = async (): Promise<number | null> => {
    if (!selectedBot || !userId || interactionId) return interactionId ?? null;
    setPreviewLoading(true);
    try {
      const data = await authApi.startChat(selectedBot.id, userId);
      setInteractionId(data.interaction_id);
      setLastActivityTime(new Date());

      sessionExpiryRef.current = setTimeout(() => {
        endChatSession();
      }, 6 * 60 * 60 * 1000);
      return data.interaction_id;
    } catch (error) {
      console.error("Failed to start chat session:", error);
      return null;
    } finally {
      setPreviewLoading(false);
    }
  };

  const canSendMessage = () => {
    console.log(
      "messageUsage.baseRemaining + messageUsage.addonRemaining=>",
      messageUsage.baseRemaining + messageUsage.addonRemaining
    );
    console.log(
      "messageUsage.effectiveRemaining=>",
      messageUsage.effectiveRemaining
    );
    return messageUsage.effectiveRemaining > 0;
    //return (messageUsage.baseRemaining + messageUsage.addonRemaining) > 0;
  };

  const sendMessage = async () => {

   
    // First check if we can send (either base or addon messages available)
    if (!canSendMessage()) {
      toast.error(
        "You have reached your message limit, please upgrade your plan."
      );
      return;
    }
     
    // Then check if we have any remaining messages (base or addon)
    if (messageUsage.effectiveRemaining <= 0) {
      toast.error("You've used all your available messages for this period.");
      return;
    }

    // Determine if we're using addon messages
    const isAddonMessage =
      messageUsage.baseRemaining <= 0 && messageUsage.addonRemaining > 0;
    console.log("isAddonMessage", isAddonMessage);

    if (!inputMessage.trim()) return;
    setWaitingForBotResponse(true);

    let sessionId: number | null = interactionId ?? null;
    if (!sessionId) {
      sessionId = await startChatSession();
      setInteractionId(sessionId);
    }

    if (!sessionId) return;

    handleUserActivity();

    const newMessages = [...messages, { sender: "user", text: inputMessage }];
    setMessages(newMessages);
    setInputMessage("");
    setPreviewLoading(true);

    try {
      const data = await authApi.sendMessage(
        sessionId,
        "user",
        inputMessage,
        isAddonMessage
      );
      setBotMessageId(data.message_id);

      const botMessage = {
      sender: "bot",
      text: data.message,
      message_id: data.message_id,
      is_greeting: data.is_greeting,
      sources: data.sources || [], // Add sources to this message
      showSources: false // Start with sources hidden
    };


      // CALL RECORD USAGE IF USING ADDON
      if (isAddonMessage) {
        await authApi.recordAddonUsage(3, 1);
        //Update local state
        setAddonUsage((prev) => ({
          ...prev,
          [3]: (prev[3] || 0) + 1,
        }));
      }

      const thinkingDelay = Math.random() * 1000 + 500;
      setTimeout(() => {
        //setIsBotTyping(true);
        setIsBotTyping(true);
        setWaitingForBotResponse(false);
        //setCurrentBotMessage("");
        setCurrentBotMessage(data.message.charAt(0)); // Start with first char
        setFullBotMessage(data.message);

        let charIndex = 0;
        const baseTypingSpeed = 25;
        const typingInterval = setInterval(() => {
          if (charIndex < data.message.length) {
            setCurrentBotMessage(
              (prev) => prev + data.message.charAt(charIndex)
            );
            charIndex++;

            if (
              [".", "!", "?", ",", ":"].includes(
                data.message.charAt(charIndex - 1)
              )
            ) {
              clearInterval(typingInterval);
              setTimeout(() => {
                startTypingAnimation(
                  charIndex,
                  data.message,
                  data.message_id,
                  newMessages,
                  botMessage 
                );
              }, 200 + Math.random() * 200);
            }
          } else {
            clearInterval(typingInterval);
            setIsBotTyping(false);
            // setMessages([
            //   ...newMessages,
            //   {
            //     sender: "bot",
            //     text: data.message,
            //     message_id: data.message_id,               
            //   },
            //   botMessage
            // ]);
          }
        }, baseTypingSpeed);
      }, thinkingDelay);
      updateMessageCount();
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsBotTyping(false);
    } finally {
      setPreviewLoading(false);
    }
  };

 
  const startTypingAnimation = (
    startIndex: number,
    fullMessage: string,
    message_id: number,
    newMessages: Array<{ sender: string; text: string }>,
    botMessage: { // Add this parameter
    sender: string;
    text: string;
    message_id?: number;
    is_greeting?: boolean;
    sources?: Array<{
      file_name: string;
      source: string;
      content_preview: string;
      website_url: string;
      url: string;
    }>;
    showSources?: boolean;
  }
  ) => {
    let charIndex = startIndex;
    const baseTypingSpeed = 25;

    const typingInterval = setInterval(() => {
      if (charIndex < fullMessage.length) {
        setCurrentBotMessage((prev) => prev + fullMessage.charAt(charIndex));
        charIndex++;

        if (
          [".", "!", "?", ",", ":"].includes(fullMessage.charAt(charIndex - 1))
        ) {
          clearInterval(typingInterval);
          setTimeout(() => {
            startTypingAnimation(
              charIndex,
              fullMessage,
              message_id,
              newMessages,
              botMessage
            );
          }, 200 + Math.random() * 200);
        }
      } else {
        clearInterval(typingInterval);
        setIsBotTyping(false);
        // setMessages([
        //   ...newMessages,
        //   { sender: "bot", text: fullMessage, message_id: message_id},
        //   botMessage
        // ]);
        setMessages([...newMessages, botMessage]);
        
      }
    }, baseTypingSpeed);
  };

  const toggleSources = (index: number) => {
  setMessages(prev => prev.map((msg, i) => {
    if (i === index && msg.sender === "bot") {
      return { 
        ...msg, 
        showSources: !msg.showSources 
      };
    }
    return msg;
  }));
};

  const handleSaveSettings = async () => {
    try {
      if (!userId) return;
      const updatedSettings = {
      ...settings,
      lead_form_config: settings.lead_generation_enabled ? settings.lead_form_config : [],
       };
      if (isBotExisting && botId) {
        console.log("settings", settings);
        await updateBotSettings(botId, userId, updatedSettings, setLoading);
      } else {
        await saveBotSettings(updatedSettings, userId, setLoading);
      }
      toast.success("Your bot settings have been saved!");
    } catch (error) {
      console.error(error);
      toast.error("Unable to save your bot settings. Please try again.");
    }
  };


const handlePredefinedIconSelect = async (iconUrl: string) => {
  try {
    setLoading(true);
    setSelectedPredefinedIcon(iconUrl);
    // Fetch image as blob
    const response = await fetch(iconUrl);
    const blob = await response.blob();

    // Convert blob to File
    const fileName = iconUrl.split("/").pop() || "icon.png";
    const file = new File([blob], fileName, { type: blob.type });

    // Use the same upload handler
    await handleIconUpload(file);
  } catch (error) {
    console.error("Failed to upload predefined icon:", error);
    toast.error("Failed to upload predefined icon.");
  } finally {
    setLoading(false);
  }
};


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleIconUpload(e.target.files[0]);
    }
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(
                  new File([blob], file.name, {
                    type: "image/jpeg",
                    lastModified: Date.now(),
                  })
                );
              } else {
                reject(new Error("Failed to compress image"));
              }
            },
            "image/jpeg",
            0.7
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleIconUpload = async (file: File) => {
    setLoading(true);
    try {
      if (file.size > 1024 * 1024) {
        file = await compressImage(file);
      }
      const formData = new FormData();
      formData.append("bot_id", selectedBot.id.toString());
      formData.append("file", file);
      console.log("formData",formData)
      const response = await authApi.uploadBotIcon(formData);
      console.log("url",response.url)
      handleChange("icon", response.url);
    } catch (error) {
      console.error("Failed to upload bot icon:", error);
      toast.error("Failed to upload bot icon.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = <K extends keyof BotSettings>(
    field: K,
    value: BotSettings[K]
  ) => {
    // Add welcome message validation here
  if (field === "welcomeMessage" && typeof value === "string") {
    const isValidWelcomeMessage = (message: string) => {
      const maxWordLength = 20;

      if (/(.)\1{6,}/.test(message)) return false;
      if (message.split(" ").some((word) => word.length > maxWordLength)) return false;
      return true;
    };

    if (!isValidWelcomeMessage(value)) {
      console.warn("Invalid welcome message");
      return; // Don't update if invalid
    }
  }

        // Add Bot Name  validation here
  if (field === "name"  && typeof value === "string") {
    const isValidWelcomeMessage = (message: string) => {
      const maxWordLength = 15;

      if (/(.)\1{4,}/.test(message)) return false;
      if (message.split(" ").some((word) => word.length > maxWordLength)) return false;
      return true;
    };

    if (!isValidWelcomeMessage(value)) {
      console.warn("Invalid Boat name");
      return; // Don't update if invalid
    }
  }
    setSettings((prev) => {
      const newSettings = { ...prev, [field]: value };

      // When appearance changes to Full Screen, set position to bottom-right
      if (field === "appearance" && value === "Full Screen") {
        newSettings.position = "bottom-right";
      }

      // Two-way synchronization between text colors and timestamp colors
      if (field === "chatTextColor") {
        newSettings.timestampColor = value as string;
      } else if (field === "timestampColor") {
        newSettings.chatTextColor = value as string;
      } else if (field === "userTextColor") {
        newSettings.userTimestampColor = value as string;
      } else if (field === "userTimestampColor") {
        newSettings.userTextColor = value as string;
      }

      return newSettings;
    });
  };

const ThemeSelector: React.FC<{
  themes: Theme[];
  selectedTheme: string;
  onSelect: (themeId: string) => void;
  onReset: () => void;
}> = ({ themes, selectedTheme, onSelect, onReset }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Select a theme</h3>
      <div className="flex flex-wrap gap-4">
        {themes.map((theme) => (
          <div
            key={theme.id}
            onClick={() => onSelect(theme.id)}
            className={`cursor-pointer p-2 border-2 rounded-lg transition-all ${
              selectedTheme === theme.id
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            style={{ width: '120px' }}
          >
            <div className="flex flex-col items-center">
              <div
                className="w-full h-16 rounded mb-2"
                style={{
                  background: `linear-gradient(135deg, ${theme.botColor} 50%, ${theme.userColor} 50%)`
                }}
              ></div>
              <span className="text-sm font-medium text-center">{theme.name}</span>
            </div>
          </div>
        ))}
      </div>
      
      {selectedTheme !== 'none' && (
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Using <span className="font-medium">
              {selectedTheme === 'custom' ? 'Custom' : themes.find(t => t.id === selectedTheme)?.name}
            </span> theme
          </div>
          {/* {selectedTheme !== 'custom' && (
            <button 
              onClick={onReset}
              className="px-2 py-1 text-sm border border-blue-500 text-blue-500 rounded hover:bg-blue-50"
            >
              Reset The Changes
</button>
          )} */}
        </div>
      )}
    </div>
  );
};
  const tabOptions = [
    { id: "identity", label: "General", icon: MessageSquare },
    // { id: "typography", label: "Typography", icon: Type },
    { id: "colors", label: "Customize", icon: Palette },
    // { id: "layout", label: "Layout", icon: Move },
    // { id: "behavior", label: "Behavior", icon: Sliders },
    // { id: "unanswered", label: "Unanswered Replies", icon: MessageCircle },
    {id:"control" ,label:"Advance", icon:MessageCircle}
  ];


  const getContrastColor = (bgColor: string) => {
  if (!bgColor) return '#6b7280'; // Default gray if no color
  
  // Convert hex to RGB
  let r = 0, g = 0, b = 0;
  if (bgColor.length === 4) {
    r = parseInt(bgColor[1] + bgColor[1], 16);
    g = parseInt(bgColor[2] + bgColor[2], 16);
    b = parseInt(bgColor[3] + bgColor[3], 16);
  } else if (bgColor.length === 7) {
    r = parseInt(bgColor.substring(1, 3), 16);
    g = parseInt(bgColor.substring(3, 5), 16);
    b = parseInt(bgColor.substring(5, 7), 16);
  }
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return dark or light color based on luminance
  return luminance > 0.5 ? '#1F2937' : '#FFFFFF';
};

const handleColorChangeWithThemeSwitch = <K extends keyof BotSettings>(
  field: K,
  value: BotSettings[K]
) => {
  // If current theme is not custom and user is changing a color, switch to custom theme
  if (selectedTheme !== 'custom' && field !== 'borderRadius' && field !== 'chatFontFamily') {
    setSelectedTheme('custom');
    toast.info('Switched to Custom theme as you modified colors');
    
  // Also update the theme in database if we have a botId
    if (botId) {
      authApi.updateBotTheme(botId, { theme_id: 'custom' })
        .catch(error => console.error("Failed to update theme:", error));
    }
  }

  // Then proceed with the normal color change handling
  handleColorChange(field, value);
};

const handleColorChange = <K extends keyof BotSettings>(
  field: K,
  value: BotSettings[K]
) => {
  setSettings(prev => {
    const newSettings = { ...prev, [field]: value };

    // // Save the customization for the current theme
    // if (selectedTheme !== 'none') {
    //   setCustomizedThemes(prevCustom => ({
    //     ...prevCustom,
    //     [selectedTheme]: {
    //       ...prevCustom[selectedTheme],
    //       [field]: value
    //     }
    //   }));
    // }

    // Two-way synchronization between text colors and timestamp colors
    if (field === "chatTextColor") {
      newSettings.timestampColor = value as string;
    } else if (field === "timestampColor") {
      newSettings.chatTextColor = value as string;
    } else if (field === "userTextColor") {
      newSettings.userTimestampColor = value as string;
    } else if (field === "userTimestampColor") {
      newSettings.userTextColor = value as string;
    }

    return newSettings;
  });
};


const resetThemeToDefault = () => {
  console.log("Reset called"); 
  if (selectedTheme === 'none') return;

  const theme = THEMES.find(t => t.id === selectedTheme);
  if (!theme) return;

  // Remove customizations for this theme first
  setCustomizedThemes(prev => {
    const newCustom = { ...prev };
    delete newCustom[selectedTheme];
    return newCustom;
  });

  // Reset settings to default values of selected theme
  const defaultSettings: Partial<BotSettings> = {
    botColor: theme.botColor,
    userColor: theme.userColor,
    chatTextColor: theme.chatTextColor,
    userTextColor: theme.userTextColor,
    windowBgColor: theme.windowBgColor,
    inputBgColor: theme.inputBgColor,
    headerBgColor: theme.headerBgColor,
    headerTextColor: theme.headerTextColor,
    buttonColor: theme.buttonColor,
    buttonTextColor: theme.buttonTextColor,
    timestampColor: theme.timestampColor,
    userTimestampColor: theme.userTimestampColor,
    borderColor: theme.borderColor
  };

  // Also update the settings
  setSettings(prev => ({
    ...prev,
    ...defaultSettings
  }));
};

const handleThemeSelect = async (themeId: string) => {
  if (!botId) return;
  
  try {
    // If selecting custom theme, don't change settings
    if (themeId === 'custom') {
      setSelectedTheme('custom');
      return;
    }

    // Save to database
    await authApi.updateBotTheme(botId, { theme_id: themeId });
    
    // If we already have customizations for this theme, apply them
    if (customizedThemes[themeId]) {
      setSettings(prev => ({
        ...prev,
        ...customizedThemes[themeId]
      }));
      setSelectedTheme(themeId);
      return;
    }

    // Otherwise apply the default theme
    setSelectedTheme(themeId);
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;
    
    const defaultThemeSettings = {
      botColor: theme.botColor,
      userColor: theme.userColor,
      chatTextColor: theme.chatTextColor,
      userTextColor: theme.userTextColor,
      windowBgColor: theme.windowBgColor,
      inputBgColor: theme.inputBgColor,
      headerBgColor: theme.headerBgColor,
      headerTextColor: theme.headerTextColor,
      buttonColor: theme.buttonColor,
      buttonTextColor: theme.buttonTextColor,
      timestampColor: theme.timestampColor,
      userTimestampColor: theme.userTimestampColor,
      borderColor: theme.borderColor
    };

    setSettings(prev => ({
      ...prev,
      ...defaultThemeSettings
    }));
  } catch (error) {
    console.error("Failed to save theme:", error);
    toast.error("Failed to save theme selection");
  }
};


  const sections = [
    {
      title: "Bot Identity",
      icon: MessageSquare,
      fields: [
        {
          // label: "Bot Avatar",
          type: "file",
          accept: "image/*",
          onChange: handleFileChange,
        },
        {
          label: "Bot Name",
          type: "text",
          value: settings.name,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("name", e.target.value),
        },

      ],
    },
    {
      title: "Theme Selection",
      icon: Palette,
      fields: [
        {
          type: "theme-selector",
          themes: THEMES,
          selectedTheme: selectedTheme,
          onSelect: handleThemeSelect,
          onReset: resetThemeToDefault,
          onCustomize: () => setShowCustomize(true)
        }
      ]
    },
    //   {
    //   title: "Typography",
    //   icon: Type,
    //   fields: [
    //     {
    //       label: "Message Font",
    //       type: "select",
    //       value: settings.chatFontFamily,
    //       options: [
    //         "Geist",
    //         "Roboto",
    //         "Open Sans",
    //         "Lato",
    //         "Sora",
    //       ],
    //       onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
    //         handleChange("chatFontFamily", e.target.value),
    //     },

    
    //     {
    //       label: "Font Size",
    //       type: "select",
    //       value: settings.fontSize,
    //       options: ["12px", "14px", "16px", "18px", "20px"],
    //       onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
    //         handleChange("fontSize", e.target.value),
    //     },
    //   ],
    // },
   ...(selectedTheme !== 'none' || showCustomize) ? [
    {
      title: "Message Colors",
      icon: Palette,
      fields: [
        {
          label: "Bot Message Background",
          type: "color",
          value: settings.botColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("botColor", e.target.value),
          
        },
        {
          label: "User Message Background",
          type: "color",
          value: settings.userColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("userColor", e.target.value),
        },
{
          label: "Bot Message Text",
          type: "color",
          value: settings.chatTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("chatTextColor", e.target.value),
        },
        {
          label: "User Message Text",
          type: "color",
          value: settings.userTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("userTextColor", e.target.value),
        }
        
      ]
    }] : [],
  ...((selectedTheme !== 'none' || showCustomize) ? [{
      title: "Interface Colors",
      icon: Palette,
      fields: [
        {
          label: "Window Background",
          type: "color",
          value: settings.windowBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("windowBgColor", e.target.value),
        },
        {
          label: "Input Box Background",
          type: "color",
          value: settings.inputBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("inputBgColor", e.target.value),
        },
        {
          label: "Header Background",
          type: "color",
          value: settings.headerBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("headerBgColor", e.target.value),
        },
        {
          label: "Header Text Color",
          type: "color",
          value: settings.headerTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("headerTextColor", e.target.value),
        },
        {
          label: "Button Color",
          type: "color",
          value: settings.buttonColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("buttonColor", e.target.value),
        },
        {
          label: "Button Text Color",
          type: "color",
          value: settings.buttonTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("buttonTextColor", e.target.value),
        },
        {
          label: "Border Color",
          type: "color",
          value: settings.borderColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("borderColor", e.target.value),
        }
      ]
    }] : []),
    {
      title: "Layout & Borders",
      icon: Move,
      fields: [
        {
          label: "Border Radius",
          type: "select",
          value: settings.borderRadius,
          options: [
            "0px",
            "4px",
            "8px",
            "12px",
            "16px",
            "20px",
            "24px",
          ],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("borderRadius", e.target.value),
        },
        {
          label: "Border Color",
          type: "color",
          value: settings.borderColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleColorChangeWithThemeSwitch("borderColor", e.target.value),
        },
      ],
    },
    {
      title: "Chat Interface Behavior",
      icon: Sliders,
      fields: [
        {
          label: "Chatbot Position",
          type: "select",
          value: settings.position,
          options: ["bottom-left", "bottom-right", "top-right"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("position", e.target.value),
          disabled: settings.appearance === "Full Screen",
          disabledStyle: { opacity: 0.3 },
        },
        {
          label: "Appearance",
          type: "select",
          value: settings.appearance,
          options: ["Popup", "Full Screen"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("appearance", e.target.value),
        },
      
      {
  label: (
    <div className="flex items-center">
      <span>Model Temperature</span>
      <div className="relative group inline-block ml-2">
        <span className="text-gray-500 hover:text-blue-500 cursor-pointer">
          ℹ️
        </span>
        <div className="absolute left-0 top-7 w-64 bg-gray-800 text-white text-xs rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg z-10 pointer-events-none">
          Controls response creativity:
          <ul className="mt-1 list-disc pl-4">
            <li><strong>0</strong>: Precise, deterministic answers</li>
            <li><strong>0.5</strong>: Balanced mix of accuracy and creativity</li>
            <li><strong>1</strong>: Maximum creativity and randomness</li>
          </ul>
          Higher values produce more detailed, varied responses, while lower values give more specific, focused answers.
        </div>
      </div>
    </div>
  ),
  
  type: "slider",
  min: 0,
  max: 1,
  step: "0.01",
  value: settings.temperature,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            handleChange("temperature", parseFloat(e.target.value));
          },
},

{
  type: "custom",
  render: () => {
     const fields: Array<"name" | "phone" | "email" | "address"> = [
      "name",
      "phone",
      "email",
      "address",
    ];

    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        {/* Enable Lead Generation Form */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={settings.lead_generation_enabled}
            onChange={(e) => {
    const enabled = e.target.checked;
    handleChange("lead_generation_enabled", enabled);

    //  If enabling, pre-select the Name field if not already present
    if (enabled) {
      const existing = settings.lead_form_config || [];
      const hasName = existing.some(f => f.field === "name");
      if (!hasName) {
        handleChange("lead_form_config", [...existing, { field: "name", required: false }]);
      }
    } else {
      //  Optionally clear the config when disabling (optional)
      handleChange("lead_form_config", []);
    }
  }}
          />
          <span>Enable Lead Generation Form</span>
        </label>

        {/* Conditionally show the additional checkboxes */}
        {settings.lead_generation_enabled && (
          <table style={{ width: "60%", maxWidth: "480px", fontSize: "14px", border: "1px solid #ccc" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9f9f9" }}>
                <th style={{ padding: "8px", textAlign: "left" }}>Field</th>
                <th style={{ padding: "8px", textAlign: "center" }}>Required</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const config = settings.lead_form_config?.find((f) => f.field === field);
                const isVisible = !!config;
                const isRequired = config?.required || false;

                return (
                  <tr key={field} style={{
                    borderTop: "1px solid #ccc",
                    opacity: isVisible ? 1 : 0.5,
                    pointerEvents: isVisible ? "auto" : "none"
                  }}>
                    <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: "8px", pointerEvents: "auto" }}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                          const updated = [...(settings.lead_form_config || [])];
                          const index = updated.findIndex((f) => f.field === field);

                          if (e.target.checked && index === -1) {
                            updated.push({ field, required: false });
                          } else if (!e.target.checked && index !== -1) {
                            updated.splice(index, 1);
                          }
                          handleChange("lead_form_config", updated);
                          if (updated.length === 0) {
                            handleChange("lead_generation_enabled", false);
                          }
                        }}
                      />
                      <span style={{ textTransform: "capitalize" }}>{field}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        disabled={!isVisible}
                        checked={isRequired}
                        onChange={(e) => {
                          const updated = [...(settings.lead_form_config || [])];
                          const index = updated.findIndex((f) => f.field === field);
                          if (index !== -1) {
                            updated[index].required = e.target.checked;
                            handleChange("lead_form_config", updated);
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }
},{
            label: (
              <span>
              <input
                  type="checkbox"
                  checked={settings.showSources}
                  onChange={(e) => handleChange("showSources", e.target.checked)}
                  style={{ marginRight: "6px" }}
                />
                    View Sources
                  </span>
                ),
                type: "custom", // or a type that allows JSX
                description: "When enabled, users can view the sources of bot responses"
      }

      ],
      
    },
{
    title: "Unanswered Replies",
    icon: MessageCircle,
    fields: [
      {
        label: "Default response when bot doesn't know the answer",
        type: "textarea",
        value: settings.unansweredMsg,
        maxLength: 200,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => 
          handleChange("unansweredMsg", e.target.value),
      },
    ],
  },  
  {
    title: "Control",
    icon: MessageCircle,
    fields: [
      {
            label: (
              <span>
              <input
                  type="checkbox"
                  checked={settings.showSources}
                  onChange={(e) => handleChange("showSources", e.target.checked)}
                  style={{ marginRight: "6px" }}
                />
                    View Sources
                  </span>
                ),
                type: "custom", 
                description: "When enabled, users can view the sources of bot responses"
                 },{
                type: "custom",
        render: () => {
     const fields: Array<"name" | "phone" | "email" | "address"> = [
      "name",
      "phone",
      "email",
      "address",
    ];

    return (
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        {/* Enable Lead Generation Form */}
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={settings.lead_generation_enabled}
            onChange={(e) => {
    const enabled = e.target.checked;
    handleChange("lead_generation_enabled", enabled);

    //  If enabling, pre-select the Name field if not already present
    if (enabled) {
      const existing = settings.lead_form_config || [];
      const hasName = existing.some(f => f.field === "name");
      if (!hasName) {
        handleChange("lead_form_config", [...existing, { field: "name", required: false }]);
      }
    } else {
      handleChange("lead_form_config", []);
    }
  }}
          />
          <span>Enable Lead Generation Form</span>
        </label>

        {/* Conditionally show the additional checkboxes */}
        {settings.lead_generation_enabled && (
          <table style={{ width: "60%", maxWidth: "480px", fontSize: "14px", border: "1px solid #ccc" }}>
            <thead>
              <tr style={{ backgroundColor: "#f9f9f9" }}>
                <th style={{ padding: "8px", textAlign: "left" }}>Field</th>
                <th style={{ padding: "8px", textAlign: "center" }}>Required</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => {
                const config = settings.lead_form_config?.find((f) => f.field === field);
                const isVisible = !!config;
                const isRequired = config?.required || false;

                return (
                  <tr key={field} style={{
                    borderTop: "1px solid #ccc",
                    opacity: isVisible ? 1 : 0.5,
                    pointerEvents: isVisible ? "auto" : "none"
                  }}>
                    <td style={{ padding: "8px", display: "flex", alignItems: "center", gap: "8px", pointerEvents: "auto" }}>
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(e) => {
                          const updated = [...(settings.lead_form_config || [])];
                          const index = updated.findIndex((f) => f.field === field);

                          if (e.target.checked && index === -1) {
                            updated.push({ field, required: false });
                          } else if (!e.target.checked && index !== -1) {
                            updated.splice(index, 1);
                          }
                          handleChange("lead_form_config", updated);
                          if (updated.length === 0) {
                            handleChange("lead_generation_enabled", false);
                          }
                        }}
                      />
                      <span style={{ textTransform: "capitalize" }}>{field}</span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        disabled={!isVisible}
                        checked={isRequired}
                        onChange={(e) => {
                          const updated = [...(settings.lead_form_config || [])];
                          const index = updated.findIndex((f) => f.field === field);
                          if (index !== -1) {
                            updated[index].required = e.target.checked;
                            handleChange("lead_form_config", updated);
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    );
  }
}
      
    ],
  },   
  ];


  // Using this in control tab

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <label className="inline-flex items-center cursor-pointer">
    <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    <div
      className={`w-11 h-6 rounded-full p-1 transition`}
      style={{
        backgroundColor: checked ? '#5348CB' : '#D1D5DB', // Fallback gray
      }}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full shadow-md transform transition ${
          checked ? 'translate-x-5' : ''
        }`}
      ></div>
    </div>
  </label>
);


  if (!selectedBot) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 ">
        <div className="text-gray-500 dark:text-white text-lg ">
          No bot selected.
        </div>
        <button
          onClick={() => navigate("/")}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Go to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900  px-4 ">
      {loading && <Loader />}
      <div className="max-w-8xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl  p-6 mb-6   ">
          <div >
          {/* <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#DFDFDF] "> */}
          <div >

         
          


<nav
  className="flex justify-between items-center border-b border-[#DFDFDF] overflow-x-auto w-full"
  aria-label="Settings tabs"
>
  <div className="flex flex-wrap sm:flex-nowrap space-x-0 sm:space-x-4 gap-2 sm:gap-0 flex-1">
    {tabOptions.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`relative z-10 px-4 pt-2 pb-3 font-medium transition-colors
          ${
            activeTab === tab.id
              ? "text-[#5348CB] border-b-2 border-[#5348CB]"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border-b-0"
          }`}
        style={{ fontFamily: "Instrument Sans, sans-serif" }}
      >
        {tab.label}
      </button>
    ))}
  </div>

  <div className="flex items-center gap-4">
    <button
      onClick={() => setShowPreview(!showPreview)}
      className="flex items-center gap-2 px-6 py-3 rounded-lg shadow-md border transition-colors duration-200 hover:bg-[#5348CB] hover:text-white mb-2"
      style={{
        backgroundColor: "white",
        borderColor: "#5348CB",
        color: "#5348CB",
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: "16px",
        fontWeight: 600,
      }}
    >
      <img
        src="/images/dummy/eye-icons.png"
        alt="Message Icon"
        className="w-5 h-5"
      />
      {showPreview ? "Hide Preview" : "Preview bot"}
    </button>
  </div>
</nav>
          </div>

{/* Control TAb Section  */}
          
{activeTab === "control" && (
  <div className="border border-[#DFDFDF] rounded-[20px] mt-2 p-5">
    <h2
      className="mb-5 text-gray-800 dark:text-white"
      style={{
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: "20px",
        fontWeight: 600,
      }}
    >
      Control Settings
    </h2>

    <div className="space-y-6">
      {/* View Sources Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block font-semibold">View Sources</label>
          <p className="text-sm text-gray-500">Let users view source links in bot responses</p>
        </div>
        <Toggle
          checked={settings.showSources}
          onChange={() => handleChange("showSources", !settings.showSources)}
        />
      </div>

      {/* Lead Generation Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block font-semibold">Enable Lead Generation</label>
          <p className="text-sm text-gray-500">Collect user details before starting the chat</p>
        </div>
        <Toggle
          checked={settings.lead_generation_enabled}
          onChange={() => {
            const enabled = !settings.lead_generation_enabled;
            handleChange("lead_generation_enabled", enabled);
            if (enabled) {
              const existing = settings.lead_form_config || [];
              const hasName = existing.some((f) => f.field === "name");
              if (!hasName) {
                handleChange("lead_form_config", [...existing, { field: "name", required: false }]);
              }
            } else {
              handleChange("lead_form_config", []);
            }
          }}
        />
      </div>

      {/* Lead Form Fields */}
      {settings.lead_generation_enabled && (
        <div className="mt-2">
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-100 text-gray-600 font-semibold">
              <tr>
                <th className="text-left px-4 py-2">Field</th>
                <th className="text-center px-4 py-2">Required</th>
              </tr>
            </thead>
            <tbody>
              {["name", "phone", "email", "address"].map((field) => {
                const config = settings.lead_form_config?.find((f) => f.field === field);
                const isVisible = !!config;
                const isRequired = config?.required || false;

                return (
                  <tr key={field} className={`border-t ${!isVisible ? "opacity-60" : ""}`}>
                    <td className="flex items-center gap-3 px-4 py-2">
                      <input
                        type="checkbox"
                        className="w-5 h-5"
                        checked={isVisible}
                        onChange={(e) => {
                          const updated = [...(settings.lead_form_config || [])];
                          const index = updated.findIndex((f) => f.field === field);

                          if (e.target.checked && index === -1) {
                            updated.push({ field, required: false });
                          } else if (!e.target.checked && index !== -1) {
                            updated.splice(index, 1);
                          }
                          handleChange("lead_form_config", updated);
                          if (updated.length === 0) {
                            handleChange("lead_generation_enabled", false);
                          }
                        }}
                      />
                      <span className="capitalize">{field}</span>
                    </td>
                    <td className="text-center px-4 py-2">
                      <input
                        type="checkbox"
                        className="w-5 h-5"
                        disabled={!isVisible}
                        checked={isRequired}
                        onChange={(e) => {
                          const updated = [...(settings.lead_form_config || [])];
                          const index = updated.findIndex((f) => f.field === field);
                          if (index !== -1) {
                            updated[index].required = e.target.checked;
                            handleChange("lead_form_config", updated);
                          }
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  </div>
)}

{/* Identity Section */}
        
{activeTab === "identity" && (
  <div className="border border-[#DFDFDF] rounded-[20px] mt-2 p-5">
    <h2
      className="mb-5 text-gray-800 dark:text-white"
      style={{
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: "20px",
        fontWeight: 600,
      }}
    >
      Bot Identity
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Row 1: Avatar */}
      <div>
        <div className="flex flex-row space-x-4 items-start">
          <div className="relative w-[100px] h-[100px]">
            <img
              src={settings.icon || "/images/bot_1.png"}
              alt="Current icon"
              className="w-[100px] h-[100px] rounded-full object-cover p-1 bg-white border border-[#DFDFDF]"
              onError={(e) => {
                e.currentTarget.onerror = null; // Prevent infinite loop if fallback also fails
                e.currentTarget.src = "/images/bot_1.png";
              }}
            />
          </div>

         {/* Upload icon and instruction text */}
          <div className="flex flex-col self-center px-4">
             {/* Upload Button */}
            <label>
              <div className="flex items-center justify-center space-x-1 border rounded-[10px] border-[#5348CB] p-2 w-[134px] h-[39px] cursor-pointer">
                <img
                  src="/images/dummy/upload-icons.png"
                  alt="Upload Icon"
                  className="w-[14px] h-[18px]"
                />
                <span
                  className="text-[14px] font-semibold text-[#5348CB]"
                  style={{ fontFamily: "Instrument Sans, sans-serif" }}                >
                  Upload Icon
                </span>
              </div>
              <input
                type="file"
                accept=".svg,.png,.jpg,image/svg+xml,image/png,image/jpeg"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
            <p
              className="mt-2 text-start text-gray-500"
              style={{
                fontSize: "14px",
                fontWeight: 400,
                fontFamily: "Instrument Sans, sans-serif",
              }}
            >
              Upload only SVG, PNG, JPG (Max 800 × 800px)
            </p>
          </div>
        </div>

     
        <div className="mt-4 flex space-x-4 pb-5 pt-5">
          {[
            "/images/bot_1.png",
            "/images/bot_2.png",
            "/images/bot_3.png",
            "/images/bot_4.png",
            "/images/bot_5.png",
          ].map((icon, idx) => (
            <div
              key={idx}
              className={`w-[50px] h-[50px] rounded-full border-2 cursor-pointer ${
                selectedPredefinedIcon === icon ? "border-[#000080]" : "border-gray-300"
              } p-1 bg-white`}
              onClick={() => handlePredefinedIconSelect(icon)}
            >
              <img
                src={icon}
                alt={`Bot Icon ${idx + 1}`}
                className="object-cover w-full h-full rounded-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col justify-start">
        <label className="block text-sm mb-1" style={{ fontFamily: "Instrument Sans, sans-serif",color: "#666666" }}>
          Bot Name
        </label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => handleChange("name", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
        />
      </div>

      <div className="flex flex-col justify-start">
        <label className="block text-sm mb-1.5" style={{ fontFamily: "Instrument Sans, sans-serif" ,color: "#666666"}}>
          Welcome Message
        </label>
        <input
          type="text"
          value={settings.welcomeMessage}
          onChange={(e) => handleChange("welcomeMessage", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
          style={{ color: "#333333"}}
        />
      </div>
      <div></div>
      <div className="flex flex-col justify-start">
        <label className="block text-sm mb-1.5" style={{ fontFamily: "Instrument Sans, sans-serif" ,color: "#666666"}}>
          Default response when bot doesn't know the answer
        </label>
        <textarea
          value={settings.unansweredMsg}
          onChange={(e) => handleChange("unansweredMsg", e.target.value)}
          maxLength={200}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
          style={{ minHeight: "60px", resize: "vertical",color: "#333333" }}
        />
        <div className="text-xs text-gray-500 text-right mt-1">
          {settings.unansweredMsg.length}/200 characters
        </div>
      </div>
      <div></div>
    </div>
  </div>
)}
  
  {activeTab === "identity" && (
  <div className="border border-[#DFDFDF] rounded-[20px] mt-6 p-5">
    <h2
      className="mb-5 text-gray-800 dark:text-white"
      style={{
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: "20px",
        fontWeight: 600,
      }}
    >
      Level of Creativity
    </h2>

    <div className="md:w-1/2">
      {/* Label with tooltip */}
      <label className="flex items-center gap-2  mb-3" style={{ fontFamily: "Instrument Sans, sans-serif" ,color: "#333333",fontSize: "16px", }}>
        Choose between creative or precise responses
        <div className="relative group inline-block">
            <Info size={20} color="white" className="bg-[#5348CB] p-1 rounded-full" />

          <div className="absolute left-0 top-7 w-64 bg-gray-800 text-white text-xs rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg z-10 pointer-events-none">
            Controls response creativity:
            <ul className="mt-1 list-disc pl-4">
              <li><strong>0</strong>: Precise, deterministic answers</li>
              <li><strong>0.5</strong>: Balanced mix of accuracy and creativity</li>
              <li><strong>1</strong>: Maximum creativity and randomness</li>
            </ul>
            <p className="mt-2">
              Higher values produce more detailed, varied responses, while lower values give more specific, focused answers.
            </p>
          </div>
        </div>
      </label>

      {/* Slider */}
      <div className="relative w-full pt-4">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.temperature}
          onChange={(e) => handleChange("temperature", parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          style={{
    accentColor: '#5348CB', 
  }}
        />
        <span
          className="absolute inline-block px-2 py-1 text-xs font-semibold text-white rounded"
          style={{
            backgroundColor: "#5348CB",
            top: "-10px",
            left: `calc(${settings.temperature * 100}% - 12px)`,
            transform: "translateX(-50%)",
          }}
        >
          {settings.temperature}
        </span>
      </div>
    </div>
  </div>
)}
{/* Color Tab that is now Customize Tab  Section */}

{/* Theme Section */}

{activeTab === "colors" && (
  <>
    {/* Theme Selection Box */}
    <div className=" rounded-[20px] mt-6 p-5 w-full">
      <h2
        className="mb-5 text-gray-800 dark:text-white"
        style={{
          fontFamily: "Instrument Sans, sans-serif",
          fontSize: "20px",
          fontWeight: 600,
        }}
      >
        Apply a theme or customize on your own
      </h2>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {THEMES.map((theme) => (
            <div
              key={theme.id}
              onClick={() => handleThemeSelect(theme.id)}
              className={`cursor-pointer p-2 border-2 rounded-lg transition-all ${
                selectedTheme === theme.id
                  ? "border-blue-500 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              style={{ width: "120px" }}
            >
              <div className="flex flex-col items-center">
                <div
                  className="w-full h-16 rounded mb-2"
                  style={{
                    background: `linear-gradient(135deg, ${theme.botColor} 50%, ${theme.userColor} 50%)`,
                  }}
                ></div>
                <span
                    className="text-center"
                    style={{
                    fontSize: "14px",
                    fontFamily: "Instrument Sans, sans-serif",
                    fontWeight: 400,
                    color: "#333333",
                     }}>{theme.name}</span>
              </div>
            </div>
          ))}
        </div>

        {selectedTheme !== "none" && (
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Using{" "}
              <span className="font-medium">
                {selectedTheme === "custom"
                  ? "Custom"
                  : THEMES.find((t) => t.id === selectedTheme)?.name}
              </span>{" "}
              theme
            </div>

            {/* Uncomment to allow reset */}
            {/* {selectedTheme !== "custom" && (
              <button
                onClick={resetThemeToDefault}
                className="px-2 py-1 text-sm border border-blue-500 text-blue-500 rounded hover:bg-blue-50"
              >
                Reset The Changes
              </button>
            )} */}
          </div>
        )}
      </div>
    </div>

    {/* The rest of your color customization UI can continue below */}
  </>
)}

{activeTab === "colors" && (
  <div className="border border-[#DFDFDF] rounded-[20px] mt-6 p-5">
    <h2
      className="mb-5 text-gray-800 dark:text-white"
      style={{
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: "20px",
        fontWeight: 600,
      }}
    >
      Style
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Typography Section */}
      <div>
          <label
  className="block mb-1 "
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
    
  }}
>
  Chat Messages font
</label>
        <select
          value={settings.chatFontFamily}
          onChange={(e) => handleChange("chatFontFamily", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
           style={{ color: "#333333"}}
        >
          <option value="Geist">Geist</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="Lato">Lato</option>
          <option value="Sora">Sora</option>
        </select>
      </div>

      <div>
          <label
  className="block mb-1 "
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
    
  }}
>
  Font size
</label>
        <select
          value={settings.fontSize}
          onChange={(e) => handleChange("fontSize", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
           style={{ color: "#333333" }}
        >
          <option value="12px">12px</option>
          <option value="14px">14px</option>
          <option value="16px">16px</option>
          <option value="18px">18px</option>
          <option value="20px">20px</option>
        </select>
      </div>

      {/* Message Colors Section */}
      <div>
      <label
  className="block mb-1 ml-12 pl-2"
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
  }}
>
  Bot Message Background
</label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.botColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("botColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.botColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("botColor", e.target.value)}
            placeholder="#FFFFFF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      

      <div>
         <label
  className="block mb-1 ml-12 pl-2"
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
  }}
>
  User Message Background
</label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.userColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("userColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.userColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("userColor", e.target.value)}
            placeholder="#FFFFFF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
         <label
  className="block mb-1 ml-12 pl-2"
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
  }}
>
  Bot Message Text
</label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.chatTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("chatTextColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.chatTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("chatTextColor", e.target.value)}
            placeholder="#000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
         <label
             className="block mb-1 ml-12 pl-2"
          style={{
                fontFamily: "Instrument Sans, sans-serif",
              fontSize: "14px",
              fontWeight: 400,
              color: "#333333",
              }}
           >
             User Message Text
               </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.userTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("userTextColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.userTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("userTextColor", e.target.value)}
            placeholder="#000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      {/* Interface Colors Section */}
      <div>
         <label
            className="block mb-1 ml-12 pl-2"
            style={{
         fontFamily: "Instrument Sans, sans-serif",
          fontSize: "14px",
          fontWeight: 400,
          color: "#333333",
        }}
           >
            Window Background
           </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.windowBgColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("windowBgColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.windowBgColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("windowBgColor", e.target.value)}
            placeholder="#FFFFFF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
         <label
  className="block mb-1 ml-12 pl-2"
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
  }}
>
  Input Background
</label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.inputBgColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("inputBgColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.inputBgColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("inputBgColor", e.target.value)}
            placeholder="#FFFFFF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
         <label
  className="block mb-1 ml-12 pl-2"
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
  }}
>
  Header Background
</label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.headerBgColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("headerBgColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.headerBgColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("headerBgColor", e.target.value)}
            placeholder="#FFFFFF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
        {/* <label className="block text-sm font-medium text-gray-800 mb-1">Header Text Color</label> */}
         <label
         className="block mb-1 ml-12 pl-2"
         style={{
         fontFamily: "Instrument Sans, sans-serif",
        fontSize: "14px",
         fontWeight: 400,
         color: "#333333",
          }}
          >
            Header Text Color
        </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.headerTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("headerTextColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.headerTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("headerTextColor", e.target.value)}
            placeholder="#000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
         <label
      className="block mb-1 ml-12 pl-2"
       style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "14px",
            fontWeight: 400,
            color: "#333333",
              }}
          >
        Button Color
       </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.buttonColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("buttonColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.buttonColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("buttonColor", e.target.value)}
            placeholder="#0000FF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      <div>
         <label
          className="block mb-1 ml-12 pl-2"
          style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "14px",
              fontWeight: 400,
              color: "#333333",
            }}
            >
             Button Text Color
           </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.buttonTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("buttonTextColor", e.target.value)}
            className="w-12 h-12 rounded border"
          />
          <input
            type="text"
            value={settings.buttonTextColor}
            onChange={(e) => handleColorChangeWithThemeSwitch("buttonTextColor", e.target.value)}
            placeholder="#FFFFFF"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

    </div>
  </div>
)}


{activeTab === "colors" && (
  <div className="border border-[#DFDFDF] rounded-[20px] mt-6 p-5">
    <h2
      className="mb-5 text-gray-800 dark:text-white"
      style={{
        fontFamily: "Instrument Sans, sans-serif",
        fontSize: "20px",
        fontWeight: 600,
      }}
    >
      Appearance
    </h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Border Radius */}
      <div>
         <label
           className="block mb-1 "
          style={{
            fontFamily: "Instrument Sans, sans-serif",
            fontSize: "14px",
            fontWeight: 400,
            color: "#333333",
            }}
           >
         Border Radius
            </label>
        <select
          value={settings.borderRadius}
          onChange={(e) => handleChange("borderRadius", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
           style={{ color: "#333333" }}
        >
          <option value="0px">0px</option>
          <option value="4px">4px</option>
          <option value="8px">8px</option>
          <option value="12px">12px</option>
          <option value="16px">16px</option>
          <option value="20px">20px</option>
        </select>
      </div>

      {/* Border Color */}
      <div>
         <label
          className="block mb-1 ml-12 pl-2"
           style={{
           fontFamily: "Instrument Sans, sans-serif",
           fontSize: "14px",
           fontWeight: 400,
           color: "#333333",
              }}
                 >
            Border Color
            </label>
        <div className="flex items-center space-x-2">
          <input
            type="color"
            value={settings.borderColor}
            onChange={(e) =>
              handleColorChangeWithThemeSwitch("borderColor", e.target.value)
            }
            className="w-12 h-12 border rounded"
          />
          <input
            type="text"
            value={settings.borderColor}
            onChange={(e) =>
              handleColorChangeWithThemeSwitch("borderColor", e.target.value)
            }
            placeholder="#C8E6C9"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
             style={{ color: "#333333" }}
          />
        </div>
      </div>

      {/* Chatbot Position */}
      <div>
        
          <label
            className="block mb-1 "
             style={{
              fontFamily: "Instrument Sans, sans-serif",
              fontSize: "14px",
              fontWeight: 400,
              color: "#333333",
                 }}
               >
               Chatbot Position
               </label>
        <select
          value={settings.position}
          onChange={(e) => handleChange("position", e.target.value)}
          disabled={settings.appearance === "Full Screen"}
           style={{
          opacity: settings.appearance === "Full Screen" ? 0.3 : 1,
           color: "#333333",
           }}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-20"
           
          
          
        >
          <option value="bottom-left">Bottom Left</option>
          <option value="bottom-right">Bottom Right</option>
          <option value="top-right">Top Right</option>
        </select>
      </div>

      {/* Appearance */}
      <div>
          <label
  className="block mb-1 "
  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "14px",
    fontWeight: 400,
    color: "#333333",
  }}
>
  Appearance
</label>
        <select
          value={settings.appearance}
          onChange={(e) => handleChange("appearance", e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2"
           style={{ color: "#333333" }}
        >
          <option value="Popup">Popup</option>
          <option value="Full Screen">Full Screen</option>
        </select>
      </div>
    </div>
  </div>
)}
          {/* Settings Sections */}
          <div className="rounded-[20px] mt-2 p-5">
          <div className="space-y-6">
              
              {/* we were using different approach  before but now we need more customization in our page's that's why we are moving toward direct tab call  */}

          </div>
          <div className="flex justify-start mt-8 ml-0">
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className={`px-0 py-2 rounded-lg transition-colors font-medium ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[#5348CB] hover:bg-[#4239A4] text-white"
                } w-[102px] h-[48px]`}
                style={{
                  fontFamily: "Instrument Sans, sans-serif",
                  fontSize: "16px",
                  color: "#FFFFFF",
                }}
              >
                {loading ? "Saving..." : "  Save "}
              </button>
            </div>
            </div>
        </div>
      </div>

      <ToastContainer position="top-right" autoClose={3000} />

      {/* Floating Preview Toggle Button */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className={`fixed ${
          settings.position === "bottom-right"
            ? "bottom-10 right-10"
            : settings.position === "bottom-left"
            ? "bottom-6 left-6"
            : "top-6 right-6"
        } 
                  w-[60px] h-[60px] p-0 rounded-full shadow-lg z-50 overflow-hidden transition-transform duration-300 ease-in-out
                  ${
                    showPreview ? "scale-0 opacity-0" : "scale-100 opacity-100"
                  }`}
        style={{
          backgroundColor: settings.icon ? "transparent" : settings.botColor,
        }}
      >
        {settings.icon ? (
          <img
            src={settings.icon}
            alt="Bot"
            className="w-full h-full object-cover"
             onError={(e) => {
                  e.currentTarget.onerror = null; // Prevent infinite loop if fallback also fails
                  e.currentTarget.src = "/images/bot_1.png";
                }}
          />
        ) : (
          <MessageCircle className="w-full h-full text-white p-3" />
        )}
      </button>

      {/* Popup Preview Panel */}
      {showPreview && (
        <div
          className={`fixed ${
            settings.position === "bottom-right"
              ? "bottom-6 right-6"
              : settings.position === "bottom-left"
              ? "bottom-6 left-6"
              : "top-6 right-6"
          } 
                       z-50 transition-all duration-300 ease-in-out
                       ${
                         settings.appearance === "Popup"
                           ? "w-[331px] h-[517px]"
                           : "fixed top-0 left-0 w-screen h-screen"
                       }`}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col h-full overflow-hidden"
            style={{
              borderRadius:
                settings.borderRadius === "rounded-full"
                  ? "20px"
                  : settings.borderRadius,
              border: `1px solid ${settings.borderColor}`,
            }}
          >
            {/* Preview Header */}
            <div
              className="flex justify-between items-center   h-[70px] flex-none "
              style={{
                backgroundColor: settings.headerBgColor,
                color: settings.headerTextColor,
              }}
            >
              <div className="flex items-center ml-2 gap-2">
                {settings.icon && (
                  <img
                    src={settings.icon}
                    alt="Bot Icon"
                    style={{
                      width: "40px",
                      height: "35px",
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                )}
                <h2
                  className="text-lg font-semibold flex items-center" 
                  style={{fontFamily: "Instrument Sans, sans-serif", color: settings.headerTextColor }}
                >
                  {settings.name}{" "}
                  {/* <span className="text-xs ml-2 opacity-70">(preview)</span> */}
                </h2>
              </div>
              <div className="flex items-center space-x-4 ">
                <div className="flex flex-col space-y-1 text-sm bg-opacity-20 bg-white px-3 py-2 rounded-lg ">
                  <div
                    className="font-medium"
                    style={{ color: settings.headerTextColor,fontStyle: "Instrument Sans, sans-serif" }}
                  >
                    <span>
                      Msgs: {messageUsage.totalUsed}/
                      {messageUsage.totaloveralllimit}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreview(false)}
                  style={{ color: settings.headerTextColor }}
                  className="hover:opacity-75"
                >
                  {/* <X className="w-5 h-5" /> */}
                  <img
                       src="/images/dummy/close-icons.png"
                       alt="Close"
                       className="w-5 h-5 object-contain mr-2"
                      />
                </button>
              </div>
            </div>

            {/* Chat Window */}
            <div
              ref={chatContainerRef}
              className="relative rounded-lg p-4 flex-grow overflow-y-auto flex flex-col  "
              style={{
                backgroundColor: settings.windowBgColor,
                fontFamily: settings.chatFontFamily || settings.fontStyle,
              }}
            >
              {/* Content directly starts with messages now */}
              <div className="flex-1"></div>
              {messages.length > 0 ? (
                messages.map((msg, index) => (
                  <div key={index} className="mb-4">
                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-lg max-w-[80%] w-fit break-words whitespace-pre-wrap min-w-0 ${
                        msg.sender === "user" ? "ml-auto" : "mr-auto"
                      }`}
                      style={{
                        backgroundColor:
                          msg.sender === "user"
                            ? settings.userColor
                            : settings.botColor,
                        color:
                          msg.sender === "user"
                            ? settings.userTextColor
                            : settings.chatTextColor,
                        fontSize: settings.fontSize,
                        fontFamily:
                          settings.chatFontFamily || settings.fontStyle,
                        borderRadius:
                          settings.borderRadius === "rounded-full"
                            ? "20px"
                            : settings.borderRadius,
                      }}
                    >
                      <div>{msg.text}</div>
                      <div
                        className="text-xs mt-1 text-right"
                        style={{
                          color:
                            msg.sender === "user"
                              ? settings.userTimestampColor
                              : settings.timestampColor,
                        }}
                      >
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {/* Reaction Buttons BELOW the bubble, only for bot */}
                    {msg.sender === "bot" && index > 0 && (
                      <div className="flex gap-2 mt-1 ml-2 ">
                        <div className="flex gap-2">
                        <button
                          onClick={() => handleReaction("like", index)}
                          className={`p-1 rounded-full transition-colors  ${
                            msg.reaction === "like"
                              ? "text-green-500 fill-green-500"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReaction("dislike", index)}
                          className={`p-1 rounded-full transition-colors  ${
                            msg.reaction === "dislike"
                              ? "text-red-500 fill-red-500"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                                 {/* Copy Button */}
                        <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          setCopiedIndex(index); // show "Copied!"
                          setTimeout(() => setCopiedIndex(null), 1500);
                        }}
                        className="text-gray-500 hover:text-gray-700 text-[11px] flex items-center gap-1"
                      >
                        {copiedIndex === index ? (
                          "Copied!"
                        ) : (
                          <>
                            {/* Copy SVG Icon */}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      </div>
                      {/* Add View Sources button */}
                       {settings.showSources && msg.sources && msg.sources.length > 0 && !msg.is_greeting && (
                        <button 
                        onClick={() => toggleSources(index)}
                        className="text-xs text-blue-500 hover:text-blue-700 text-left"
                      >
                      {msg.showSources ? 'Hide Sources' : 'View Sources'}
                        </button>
                          )}
                    {settings.showSources && msg.showSources && msg.sources && msg.sources.length > 0 && !msg.is_greeting && (
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                       <ul className="space-y-2">
                      {msg.sources.map((source, idx) =>(
                      <li key={idx}>
                          {/* Display type based on source */}
                           {source.source === 'upload' && (
                           <>
                              <span className="font-semibold">Source Type: Files</span>
                              <div className="text-gray-600">File Name: {source.file_name}</div>
                            </>
                      )}
                        {source.source === 'website' && (
                        <>
                            <span className="font-semibold">Source Type: Website</span>
                            <div className="text-gray-600">URL: {source.website_url}</div>
                        </>
                    )}
                        {source.source === 'youtube' && (
                        <>
                            <span className="font-semibold">Source Type: YouTube</span>
                            <div className="text-gray-600">URL: {source.url}</div>
                        </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                )}
                      </div>
                      
                    )}
                  </div>
                ))
              ) : (
                <div
                  className="mr-auto p-3 rounded-lg max-w-[80%]"
                  style={{
                    backgroundColor: settings.botColor,
                    color: settings.chatTextColor,
                    fontSize: settings.fontSize,
                    fontFamily: settings.chatFontFamily || settings.fontStyle,
                    borderRadius:
                      settings.borderRadius === "rounded-full"
                        ? "20px"
                        : settings.borderRadius,
                  }}
                >
                  {settings.welcomeMessage}
                  <div
                    className="text-xs mt-1 text-right"
                    style={{ color: settings.timestampColor }}
                  >
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              )}{settings.lead_generation_enabled && (settings.lead_form_config?.length ?? 0) > 0 && !formSubmitted &&(
                    <div
                      style={{
                        marginBottom: "16px",
                        maxWidth: "80%",
                        backgroundColor: settings.botColor || "#ffffff",
                        color: settings.chatTextColor || "#111827",
                        borderRadius: settings.borderRadius === "rounded-full" ? "20px" : settings.borderRadius || "8px",
                        padding: "12px",
                        fontFamily: settings.chatFontFamily,
                        fontSize: settings.fontSize,
                        marginLeft: "0px",
                        marginRight: "auto",
                        boxSizing: "border-box",
                      }}
                    >
                      <div style={{ marginBottom: "8px", fontWeight: 500 }}>
                        Please enter your details to continue:
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                         {settings.lead_form_config?.some(f => f.field === "name") && (
                        <div style={{ position: "relative", width: "100%" }}>
                          <input
                            type="text"
                            placeholder="Name"
                            value={leadName}
                            onChange={(e) => setLeadName(e.target.value)}
                            maxLength={50}
                            style={{
                              width: "100%",
                              padding: "10px 20px 10px 10px", // Add right padding for asterisk
                              borderRadius:
                                settings.borderRadius === "rounded-full"
                                  ? "20px"
                                  : settings.borderRadius || "8px",
                              border: `1px solid ${settings.borderColor || "#ccc"}`,
                              fontSize: settings.fontSize,
                              color: settings.chatTextColor || "#111827",
                              backgroundColor: "#fff",
                              boxSizing: "border-box",
                            }}
                          />
                          {settings.lead_form_config?.find(f => f.field === "name")?.required && (
                          <span
                            style={{
                              position: "absolute",
                              right: "10px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "red",
                              fontWeight: "bold",
                              pointerEvents: "none",
                            }}
                          >
                            *
                          </span>)}
                        </div>
                        )}
                         {/* Phone (required) */}
                               {settings.lead_form_config?.some(f => f.field === "phone") && (
                             <div style={{ position: "relative", width: "100%" }}>
                          <input
                            type="tel"
                            placeholder="Phone"
                            value={leadPhone}
                             onChange={(e) => {
                              const value = e.target.value;
                              const filteredValue = value.replace(/[^0-9+-]/g, "");
                              setLeadPhone(filteredValue);
                            }}
                            maxLength={50}
                            style={{
                              width: "100%",
                              padding: "10px 20px 10px 10px", // Add right padding for asterisk
                              borderRadius:
                                settings.borderRadius === "rounded-full"
                                  ? "20px"
                                  : settings.borderRadius || "8px",
                              border: `1px solid ${settings.borderColor || "#ccc"}`,
                              fontSize: settings.fontSize,
                              color: settings.chatTextColor || "#111827",
                              backgroundColor: "#fff",
                              boxSizing: "border-box",
                            }}
                          />
                          {settings.lead_form_config?.find(f => f.field === "phone")?.required && (
                          <span
                            style={{
                              position: "absolute",
                              right: "10px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "red",
                              fontWeight: "bold",
                              pointerEvents: "none",
                            }}
                          >
                            *
                          </span>)}
                        </div>
)}
                        {/* Email (optional) */}

                          {settings.lead_form_config?.some(f => f.field === "email") && (
                          <div style={{ position: "relative", width: "100%" }}>
                          <input
                            type="email"
                            placeholder="Email"
                            value={leadEmail}
                            onChange={(e) => setLeadEmail(e.target.value)}
                            maxLength={100}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius:
                                settings.borderRadius === "rounded-full"
                                  ? "20px"
                                  : settings.borderRadius || "8px",
                              border: `1px solid ${settings.borderColor || "#ccc"}`,
                              fontSize: settings.fontSize,
                              color: settings.chatTextColor || "#111827",
                              backgroundColor: "#fff",
                              boxSizing: "border-box",
                            }}
                          />
                          {settings.lead_form_config?.find(f => f.field === "email")?.required && (
                          <span
                            style={{
                              position: "absolute",
                              right: "10px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "red",
                              fontWeight: "bold",
                              pointerEvents: "none",
                            }}
                          >
                            *
                          </span>)}
                        </div>
)}
                          {/* Address (optional) */}
                            {settings.lead_form_config?.some(f => f.field === "address") && (
                            <div style={{ position: "relative", width: "100%" }}>
                          <input
                            type="text"
                            placeholder="Address"
                            value={leadAddress}
                            onChange={(e) => setLeadAddress(e.target.value)}
                            maxLength={100}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius:
                                settings.borderRadius === "rounded-full"
                                  ? "20px"
                                  : settings.borderRadius || "8px",
                              border: `1px solid ${settings.borderColor || "#ccc"}`,
                              fontSize: settings.fontSize,
                              color: settings.chatTextColor || "#111827",
                              backgroundColor: "#fff",
                              boxSizing: "border-box",
                            }}
                          />
                          {settings.lead_form_config?.find(f => f.field === "address")?.required && (
                          <span
                            style={{
                              position: "absolute",
                              right: "10px",
                              top: "50%",
                              transform: "translateY(-50%)",
                              color: "red",
                              fontWeight: "bold",
                              pointerEvents: "none",
                            }}
                          >
                            *
                          </span>)}
                        </div>

)}
                        {emailError && (
                          <div style={{ color: "red", fontSize: "13px" }}>{emailError}</div>
                        )}

                        <button
                          onClick={async () => {
                             const requiredFields = settings.lead_form_config?.filter(f => f.required).map(f => f.field) || [];
                            let errorMessage = "";

                          if (requiredFields.includes("name") && !leadName.trim()) {
                            errorMessage = "Name is required.";
                          }
                          if (!errorMessage && requiredFields.includes("phone") && !leadPhone.trim()) {
                            errorMessage = "Phone is required.";
                          }
                          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

                          const emailField = requiredFields.includes("email");
                          const hasEmail = leadEmail.trim().length > 0;

                          if (!errorMessage && emailField && !hasEmail) {
                            errorMessage = "Email is required.";
                          } else if (!errorMessage && hasEmail && !emailRegex.test(leadEmail.trim())) {
                            errorMessage = "Please enter a valid email address.";
                          }
                          if (!errorMessage && requiredFields.includes("address") && !leadAddress.trim()) {
                            errorMessage = "Address is required.";
                          }

                          if (errorMessage) {
                            setEmailError(errorMessage); // Or your error handler
                            return;
                          }
                            setFormSubmitted(true);
                            setEmailError("");

                          }}
                          style={{
                            padding: "10px",
                            backgroundColor: settings.buttonColor || "#3b82f6",
                            color: settings.buttonTextColor || "#fff",
                            border: "none",
                            borderRadius: settings.borderRadius === "rounded-full" ? "20px" : settings.borderRadius || "8px",
                            fontSize: "14px",
                            cursor: "pointer",
                            boxSizing: "border-box",
                          }}
                        >
                          Start Chat
                        </button>
                      </div>
                    </div>
                  )}
              {previewLoading && !isBotTyping && (
                <div
                  className="mr-auto p-3 rounded-lg max-w-[80%]"
                  style={{
                    backgroundColor: settings.botColor,
                    color: settings.chatTextColor,
                    borderRadius:
                      settings.borderRadius === "rounded-full"
                        ? "20px"
                        : settings.borderRadius,
                  }}
                >
                  <span className="animate-pulse">...</span>
                </div>
              )}
              {isBotTyping && (
                <div
                  className="mr-auto rounded-lg max-w-[80%] p-3  "
                  style={{
                    backgroundColor: settings.botColor,
                    color: settings.chatTextColor,
                    fontSize: settings.fontSize,
                    fontFamily: settings.chatFontFamily || settings.fontStyle,
                    borderRadius:
                      settings.borderRadius === "rounded-full"
                        ? "20px"
                        : settings.borderRadius,
                  }}
                >
                  {currentBotMessage}
                  <span className="inline-flex items-center ml-1  ">
                    <span
                      className="h-1.5 w-1.5 rounded-full mx-0.5 animate-bounce"
                      style={{
                        backgroundColor: settings.chatTextColor,
                        animationDelay: "0ms",
                      }}
                    ></span>
                    <span
                      className="h-1.5 w-1.5 rounded-full mx-0.5 animate-bounce"
                      style={{
                        backgroundColor: settings.chatTextColor,
                        animationDelay: "200ms",
                      }}
                    ></span>
                    <span
                      className="h-1.5 w-1.5 rounded-full "
                      style={{
                        backgroundColor: settings.chatTextColor,
                        animationDelay: "400ms",
                      }}
                    ></span>
                  </span>
                </div>
              )}
               {!hasWhiteLabeling && (
              <div
            style={{
              textAlign: "right",
              color: getContrastColor(settings.windowBgColor),// Tailwind gray-500
              fontSize: "12px",
              padding: "12px 10px",
              fontStyle: "italic",
            }}
          >
            Powered by Evolra AI
          </div>
          )}
            </div>

            {/* Chat Input */}
            <div
              className="p-4  "
              style={{
                borderColor: settings.borderColor,
                // backgroundColor: settings.windowBgColor,
              }}
            >
              <div className="flex items-center rounded-lg bg-[#E8EBF0]">
                <input
                  type="text"
                  className="flex-grow p-2 bg-[#E8EBF0]"
                  style={{
                    // backgroundColor: settings.inputBgColor,
                    borderColor: settings.borderColor,
                    // color: settings.chatTextColor,
                    borderRadius:
                      settings.borderRadius === "rounded-full"
                        ? "20px"
                        : settings.borderRadius,
                  }}
                  placeholder={
                    !canSendMessage()
                      ? "We are facing technical issue. Kindly reach out to website admin for assistance"
                      : "Type your message..."
                  }
                  value={inputMessage}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputMessage(value);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      inputMessage.trim() &&
                      canSendMessage() &&
                      !waitingForBotResponse &&
                      !isBotTyping &&
                      !previewLoading
                    ) {
                      sendMessage();
                    }
                  }}
                  disabled={!canSendMessage() ||
              (settings.lead_generation_enabled && hasLeadFields && !formSubmitted)}
                />
                <button
                  className="ml-2 px-4 py-2 rounded-lg  disabled:cursor-not-allowed"
                  style={{
                    //  backgroundColor: settings.buttonColor,
                    color: settings.buttonTextColor,
                    borderRadius:
                      settings.borderRadius === "rounded-full"
                        ? "20px"
                        : settings.borderRadius,
                  }}
                  onClick={sendMessage}
                  disabled={
                    !inputMessage.trim() ||
                    !canSendMessage() ||
                    waitingForBotResponse ||
                    isBotTyping ||
                    previewLoading ||
                    inputMessage.length > MAX_USER_MESSAGE_LENGTH ||
                    (settings.lead_generation_enabled && hasLeadFields && !formSubmitted)
                  }
                >
                  {/* Send */}
                  <img
    src="/images/dummy/send-icons.png"
    alt="Send"
    className="w-5 h-5 object-contain"  
  
  />
                </button>
              </div>
              {/* Show warning if max length reached */}
              {inputMessage.length >= MAX_USER_MESSAGE_LENGTH && (
                <div className="text-xs text-red-500 mt-1">
                  You have reached the maximum allowed characters of 1000.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};