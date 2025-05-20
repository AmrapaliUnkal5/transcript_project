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
    bot_icon: settings.icon,
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
    bot_icon: settings.icon,
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
    icon: "https://images.unsplash.com/photo-1531379410502-63bfe8cdaf6f?w=200&h=200&fit=crop&crop=faces",
    fontSize: "12px",
    fontStyle: "Inter",
    position: "bottom-right",
    maxMessageLength: 200,
    botColor: "#E3F2FD",
    userColor: "#F3E5F5",
    appearance: "Popup",
    temperature: 0,
    windowBgColor: "#F9FAFB",
    welcomeMessage: "Hi there! How can I help you today?",
    inputBgColor: "#FFFFFF",
    // New customization defaults
    headerBgColor: "#3B82F6",
    headerTextColor: "#FFFFFF",
    chatTextColor: "#1F2937",
    userTextColor: "#FFFFFF",
    buttonColor: "#3B82F6",
    buttonTextColor: "#FFFFFF",
    timestampColor: "#1F2937", 
    userTimestampColor: "#FFFFFF",
    borderRadius: "12px",
    borderColor: "#E5E7EB",
    chatFontFamily: "Inter",
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

  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState("identity");

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

          setSettings({
            name: response.bot_name,
            icon: response.bot_icon || settings.icon,
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
            userTextColor: response.user_text_color || "#FFFFFF",
            buttonColor: response.button_color || "#3B82F6",
            buttonTextColor: response.button_text_color || "#FFFFFF",
            timestampColor: response.chat_text_color || "#1F2937", // Match chat text color
            userTimestampColor: response.user_text_color || "#FFFFFF",
            borderRadius: response.border_radius || "12px",
            borderColor: response.border_color || "#E5E7EB",
            chatFontFamily: response.chat_font_family || "Inter",
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
      setMessages([]);
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

      // CALL RECORD USAGE IF USING ADDON
      if (isAddonMessage) {
        await authApi.recordAddonUsage(3, 1);
        //Update local state
        setAddonUsage((prev) => ({
          ...prev,
          [3]: (prev[3] || 0) + 1,
        }));
      }

      // setMessageUsage(prev => {
      //   const newBaseRemaining = prev.baseRemaining > 0 ? prev.baseRemaining - 1 : prev.baseRemaining;
      //   const newAddonRemaining = prev.baseRemaining <= 0 ? prev.addonRemaining - 1 : prev.addonRemaining;

      //   return {
      //     ...prev,
      //     totalUsed: prev.totalUsed + 1,
      //     baseUsed: prev.baseRemaining > 0 ? prev.baseUsed + 1 : prev.baseUsed,
      //     baseRemaining: newBaseRemaining,
      //     addonUsed: prev.baseRemaining <= 0 ? prev.addonUsed + 1 : prev.addonUsed,
      //     addonRemaining: newAddonRemaining,
      //     effectiveRemaining: prev.effectiveRemaining - 1,
      //     baseplanremaining: newBaseRemaining,
      //     addonremaining: newAddonRemaining
      //   };
      // });

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
                  newMessages
                );
              }, 200 + Math.random() * 200);
            }
          } else {
            clearInterval(typingInterval);
            setIsBotTyping(false);
            setMessages([
              ...newMessages,
              {
                sender: "bot",
                text: data.message,
                message_id: data.message_id,
              },
            ]);
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
    newMessages: Array<{ sender: string; text: string }>
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
              newMessages
            );
          }, 200 + Math.random() * 200);
        }
      } else {
        clearInterval(typingInterval);
        setIsBotTyping(false);
        setMessages([
          ...newMessages,
          { sender: "bot", text: fullMessage, message_id: message_id },
        ]);
      }
    }, baseTypingSpeed);
  };

  const handleSaveSettings = async () => {
    try {
      if (!userId) return;
      if (isBotExisting && botId) {
        console.log("settings", settings);
        await updateBotSettings(botId, userId, settings, setLoading);
      } else {
        await saveBotSettings(settings, userId, setLoading);
      }
      toast.success("Your bot settings have been saved!");
    } catch (error) {
      console.error(error);
      toast.error("Unable to save your bot settings. Please try again.");
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
      formData.append("file", file);
      const response = await authApi.uploadBotIcon(formData);
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
  setSettings((prev) => {
    const newSettings = { ...prev, [field]: value };
    
    // Two-way synchronization between text colors and timestamp colors
    if (field === 'chatTextColor') {
      newSettings.timestampColor = value as string;
    } else if (field === 'timestampColor') {
      newSettings.chatTextColor = value as string;
    } else if (field === 'userTextColor') {
      newSettings.userTimestampColor = value as string;
    } else if (field === 'userTimestampColor') {
      newSettings.userTextColor = value as string;
    }
    
    return newSettings;
  });
};

  const tabOptions = [
    { id: "identity", label: "Bot Identity", icon: MessageSquare },
    { id: "typography", label: "Typography", icon: Type },
    { id: "colors", label: "Colors", icon: Palette },
    { id: "layout", label: "Layout", icon: Move },
    { id: "behavior", label: "Behavior", icon: Sliders },
  ];

  const getTabSections = (tabId: string) => {
    switch (tabId) {
      case "identity":
        return sections.filter((s) => s.title === "Bot Identity");
      case "typography":
        return [
          ...sections.filter((s) => s.title === "Typography"),
          ...sections.filter((s) => s.title === "Typography Advanced"),
        ];
      case "colors":
        return [
          ...sections.filter((s) => s.title === "Message Colors"),
          ...sections.filter((s) => s.title === "Interface Colors"),
        ];
      case "layout":
        return [
          ...sections.filter((s) => s.title === "Window Appearance"),
          ...sections.filter((s) => s.title === "Layout & Borders"),
        ];
      case "behavior":
        return sections.filter((s) => s.title === "Chat Interface Behavior");
      default:
        return [];
    }
  };

  const sections = [
    {
      title: "Bot Identity",
      icon: MessageSquare,
      fields: [
        {
          label: "Bot Name",
          type: "text",
          value: settings.name,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("name", e.target.value),
        },
        
        {
          label: "Welcome Message",
          type: "text",
          value: settings.welcomeMessage,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("welcomeMessage", e.target.value),
        },

        {
          label: "Bot Avatar",
          type: "file",
          accept: "image/*",
          onChange: handleFileChange,
        },
      ],
    },
    {
      title: "Typography",
      icon: Type,
      fields: [
        {
          label: "Chat Messages Font",
          type: "select",
          value: settings.chatFontFamily,
          options: [
            "Inter",
            "Roboto",
            "Open Sans",
            "Lato",
            "Poppins",
            "Montserrat",
            "System Default",
          ],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("chatFontFamily", e.target.value),
        },
    
        {
          label: "Font Size",
          type: "select",
          value: settings.fontSize,
          options: ["12px", "14px", "16px", "18px", "20px"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("fontSize", e.target.value),
        },
      ],
    },
    {
      title: "Message Colors",
      icon: Palette,
      fields: [
        {
          label: "Bot Message Background",
          type: "color",
          value: settings.botColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("botColor", e.target.value),
        },
        {
          label: "User Message Background",
          type: "color",
          value: settings.userColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("userColor", e.target.value),
        },
        {
          label: "Bot Message Text",
          type: "color",
          value: settings.chatTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("chatTextColor", e.target.value),
        },
        
        {
          label: "User Message Text",
          type: "color",
          value: settings.userTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("userTextColor", e.target.value),
        },
        {
      label: "Bot Timestamp Color",
      type: "color",
      value: settings.timestampColor,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        handleChange("timestampColor", e.target.value),
    },
    {
      label: "User Timestamp Color",
      type: "color",
      value: settings.userTimestampColor,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        handleChange("userTimestampColor", e.target.value),
    },
      ],
    },
    {
      title: "Interface Colors",
      icon: Palette,
      fields: [
        {
          label: "Window Background",
          type: "color",
          value: settings.windowBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("windowBgColor", e.target.value),
        },
        {
          label: "Input Box Background",
          type: "color",
          value: settings.inputBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("inputBgColor", e.target.value),
        },
        {
          label: "Header Background",
          type: "color",
          value: settings.headerBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("headerBgColor", e.target.value),
        },
        {
          label: "Header Text Color",
          type: "color",
          value: settings.headerTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("headerTextColor", e.target.value),
        },
        {
          label: "Button Color",
          type: "color",
          value: settings.buttonColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("buttonColor", e.target.value),
        },
        {
          label: "Button Text Color",
          type: "color",
          value: settings.buttonTextColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("buttonTextColor", e.target.value),
        },
      ],
    },

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
            "rounded-full",
          ],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("borderRadius", e.target.value),
        },
        {
          label: "Border Color",
          type: "color",
          value: settings.borderColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("borderColor", e.target.value),
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
          label: "Model Temperature",
          type: "slider",
          min: 0,
          max: 1,
          step: "0.01",
          value: settings.temperature,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            handleChange("temperature", parseFloat(e.target.value));
          },
          // Add tooltip for this field
      tooltip: (
        <div className="relative group inline-block ml-2">
          <span className="text-gray-500 hover:text-blue-500 cursor-pointer">
            ℹ️
          </span>
          <div className="absolute left-0 top-7 w-64 bg-gray-800 text-white text-xs rounded-md p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg z-10">
            Controls response creativity:
            <ul className="mt-1 list-disc pl-4">
              <li><strong>0</strong>: Precise, deterministic answers</li>
              <li><strong>0.5</strong>: Balanced mix of accuracy and creativity</li>
              <li><strong>1</strong>: Maximum creativity and randomness</li>
            </ul>
            Higher values produce more detailed, varied responses, while lower values give more specific, focused answers.
          </div>
        </div>
      )
        },
      ],
    },
  ];

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      {loading && <Loader />}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Customizing: {selectedBot.name}
            </h1>
            <div className="flex items-center gap-4">
              {/* <button
                onClick={() => {
                  setBotToDelete(botId);
                  setIsConfirmOpen(true);
                }}
                disabled={loading}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                Delete
              </button> */}
              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                }`}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
            <nav
              className="flex space-x-4 overflow-x-auto pb-2"
              aria-label="Settings tabs"
            >
              {tabOptions.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-4 py-2 font-medium text-sm rounded-lg transition-colors
                    ${
                      activeTab === tab.id
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                  <tab.icon className="mr-2 h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Sections */}
          <div className="space-y-6">
            {getTabSections(activeTab).map((section) => (
              <div
                key={section.title}
                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-6 text-gray-900 dark:text-white"
              >
                <div className="flex items-center space-x-2 mb-6 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <section.icon className="w-5 h-5 text-blue-500" />
                  <h2 className="text-lg font-medium dark:text-white">
                    {section.title}
                  </h2>
                  {section.title === "Chat Interface Behavior" && (
                    <div className="relative group">
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {section.fields.map((field) => (
                    <div key={field.label} className="space-y-2">
                      {field.label === "Maximum User Message Length" ? (
                        <label className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <span>Maximum User Message Length</span>
                          <span className="text-xs italic text-gray-500">
                            Max limit 1000
                          </span>
                        </label>
                      ) : (
                        <label
                          className={`block text-sm font-medium text-gray-700 dark:text-gray-300 ${
                            field.type === "slider" ? "mb-5" : "mb-1"
                          }`}
                        >
                          {field.label}
                          {field.tooltip && field.tooltip}
                        </label>
                      )}

                      {field.type === "select" ? (
                        <select
                          value={field.value as string}
                          onChange={
                            field.onChange as React.ChangeEventHandler<HTMLSelectElement>
                          }
                          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {(field as any).options?.map((option: string) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "color" ? (
                        <div className="flex items-center space-x-3">
                          <input
                            type="color"
                            value={field.value as string}
                            onChange={
                              field.onChange as React.ChangeEventHandler<HTMLInputElement>
                            }
                            className="w-10 h-10 rounded border border-gray-300 dark:border-gray-600"
                          />
                          <input
                            type="text"
                            value={field.value as string}
                            onChange={
                              field.onChange as React.ChangeEventHandler<HTMLInputElement>
                            }
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      ) : field.type === "slider" ? (
                        <div className="relative w-full pt-6">
                          <input
                            type="range"
                            min={(field as any).min}
                            max={(field as any).max}
                            step={(field as any).step}
                            value={field.value as number}
                            onChange={
                              field.onChange as React.ChangeEventHandler<HTMLInputElement>
                            }
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                          />
                          <span
                            style={{
                              position: "absolute",
                              top: "-5px",
                              left: `calc(${
                                (((field.value as number) -
                                  (field as any).min) /
                                  ((field as any).max - (field as any).min)) *
                                100
                              }% - 12px)`,
                              transform: "translateX(-50%)",
                            }}
                            className="inline-block px-2 py-1 text-xs font-semibold text-white bg-blue-500 rounded"
                          >
                            {field.value}
                          </span>
                        </div>
                      ) : field.type === "file" ? (
                        <div className="flex flex-col space-y-2">
                          {settings.icon && (
                            <div className="flex items-center space-x-2">
                              <img
                                src={settings.icon}
                                alt="Current icon"
                                className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                              />
                              <span className="text-sm text-gray-500">
                                Current icon
                              </span>
                            </div>
                          )}
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <svg
                                className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400"
                                aria-hidden="true"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 20 16"
                              >
                                <path
                                  stroke="currentColor"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                                />
                              </svg>
                              <p className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                                Click to upload
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                SVG, PNG, JPG (MAX. 800x800px)
                              </p>
                            </div>
                            <input
                              type="file"
                              accept={(field as any).accept}
                              onChange={
                                field.onChange as React.ChangeEventHandler<HTMLInputElement>
                              }
                              className="hidden"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type={field.type}
                            value={field.value as string}
                            min={(field as any).min}
                            max={(field as any).max}
                            accept={(field as any).accept}
                            onChange={
                              field.onChange as React.ChangeEventHandler<HTMLInputElement>
                            }
                            onBlur={() => {
                              if (
                                field.label === "Maximum User Message Length" &&
                                !field.value
                              ) {
                                setSettings((prev) => ({
                                  ...prev,
                                  maxMessageLength: 200,
                                }));
                                setErrors((prev) => ({
                                  ...prev,
                                  maxMessageLength:
                                    "Maximum User Message Length is required. Defaulting to 200.",
                                }));
                              }
                            }}
                            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          {errors?.maxMessageLength &&
                            field.label === "Maximum User Message Length" && (
                              <p className="text-red-500 text-sm mt-1">
                                {errors.maxMessageLength}
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Preview Button */}
            <div className="flex justify-center mt-8">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-md"
              >
                <MessageCircle className="w-5 h-5" />
                {showPreview ? "Hide Preview" : "Show Preview"}
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
                           ? "w-[380px] h-[600px]"
                           : "w-screen h-screen top-0 left-0"
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
              className="flex justify-between items-center p-4 border-b dark:border-gray-700"
              style={{
                backgroundColor: settings.headerBgColor,
                color: settings.headerTextColor,
              }}
            >
              <h2
                className="text-lg font-semibold"
                style={{ color: settings.headerTextColor }}
              >
                Preview
              </h2>
              <div className="flex items-center space-x-4">
                <div className="flex flex-col space-y-1 text-sm bg-opacity-20 bg-white px-3 py-2 rounded-lg">
                  <div
                    className="font-medium"
                    style={{ color: settings.headerTextColor }}
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
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chat Window */}
            <div
              ref={chatContainerRef}
              className="relative rounded-lg p-4 flex-grow overflow-y-auto flex flex-col"
              style={{
                backgroundColor: settings.windowBgColor,
                fontFamily: settings.chatFontFamily || settings.fontStyle,
              }}
            >
              {/* Bot Header */}
              <div style={headerStyle}>
                {settings.icon && (
                  <img src={settings.icon} alt="Bot Icon" style={iconStyle} />
                )}
                <strong style={{ color: settings.headerTextColor }}>
                  {settings.name}
                </strong>
              </div>
              <div className="flex-1"></div>
              {messages.length > 0 ? (
                messages.map((msg, index) => (
                  <div key={index} className="mb-4">
                    {/* Message Bubble */}
                    <div
                      className={`p-3 rounded-lg max-w-[80%] ${
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
      color: msg.sender === "user" 
        ? settings.userTimestampColor 
        : settings.timestampColor 
    }}
  >
    {new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}
  </div>
</div>
                    {/* Reaction Buttons BELOW the bubble, only for bot */}
                    {msg.sender === "bot" && (
                      <div className="flex gap-2 mt-1 ml-2">
                        <button
                          onClick={() => handleReaction("like", index)}
                          className={`p-1 rounded-full transition-colors ${
                            msg.reaction === "like"
                              ? "text-green-500 fill-green-500"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReaction("dislike", index)}
                          className={`p-1 rounded-full transition-colors ${
                            msg.reaction === "dislike"
                              ? "text-red-500 fill-red-500"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
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
                  className="mr-auto rounded-lg max-w-[80%] p-3"
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
                  <span className="inline-flex items-center ml-1">
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
                      className="h-1.5 w-1.5 rounded-full mx-0.5 animate-bounce"
                      style={{
                        backgroundColor: settings.chatTextColor,
                        animationDelay: "400ms",
                      }}
                    ></span>
                  </span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <div
              className="p-4 border-t dark:border-gray-700"
              style={{
                borderColor: settings.borderColor,
                // backgroundColor: settings.windowBgColor,
              }}
            >
              <div className="flex items-center">
                <input
                  type="text"
                  className="flex-grow p-2 border rounded-lg"
                  style={{
                    backgroundColor: settings.inputBgColor,
                    borderColor: settings.borderColor,
                    color: settings.chatTextColor,
                    borderRadius:
                      settings.borderRadius === "rounded-full"
                        ? "20px"
                        : settings.borderRadius,
                  }}
                  placeholder={
                    !canSendMessage()
                      ? "We are facing technical issue. Kindly reach out to website admin for assistance"
                      : "Type a message..."
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
                  disabled={!canSendMessage()}
                />
                <button
                  className="ml-2 px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: settings.buttonColor,
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
                    inputMessage.length > MAX_USER_MESSAGE_LENGTH
                  }
                >
                  Send
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
  );
};