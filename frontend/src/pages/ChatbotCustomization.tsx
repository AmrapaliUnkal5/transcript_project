import React, { useState, useEffect, useRef } from "react";
import { Type, Move, MessageSquare, Palette, Sliders } from "lucide-react";
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

export const ChatbotCustomization = () => {
  const { loading, setLoading } = useLoader();
  const { user } = useAuth();
  //const [botToDelete, setBotToDelete] = useState<string | null>(null);
  const userId = user?.user_id;
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<number | null>(null);
  const navigate = useNavigate();
  const { selectedBot } = useBot();
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
  const { getPlanById } = useSubscriptionPlans();
  const [messageUsage, setMessageUsage] = useState({
    used: 0,
    remaining: 0,
    limit: 0,
  });
  const [planLimit, setPlanLimit] = useState(0);

  const [settings, setSettings] = useState<BotSettings>({
    name: "Support Bot",
    icon: "https://images.unsplash.com/photo-1531379410502-63bfe8cdaf6f?w=200&h=200&fit=crop&crop=faces",
    fontSize: "16px",
    fontStyle: "Inter",
    position: "top-left",
    maxMessageLength: 500,
    botColor: "#E3F2FD",
    userColor: "#F3E5F5",
    appearance: "Popup",
    temperature: 0,
    windowBgColor: "#F9FAFB",
    welcomeMessage: "Hi there! How can I help you today?",
    inputBgColor: "#FFFFFF",
  });

  const [isBotExisting, setIsBotExisting] = useState<boolean>(false);
  const [botId, setBotId] = useState<number | null>(null);
  const [waitingForBotResponse, setWaitingForBotResponse] = useState(false);
  const headerStyle: React.CSSProperties = {
    backgroundColor: settings.botColor || "#007bff",
    color: "#fff",
    padding: "10px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  };

  const iconStyle: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    objectFit: "cover",
  };

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
        const userPlan = getPlanById(user?.subscription_plan_id!);
        const messageLimit = userPlan?.message_limit || 0;
        console.log("response=>", response);
        console.log("userPlan=>", userPlan);
        console.log("messageLimit=>", messageLimit);

        setMessageUsage({
          used: response.totalMessagesUsed,
          remaining: Math.max(0, messageLimit - response.totalMessagesUsed),
          limit: messageLimit,
        });

        setPlanLimit(messageLimit);
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
            icon: response.bot_icon,
            fontSize: `${response.font_size}px`,
            fontStyle: response.font_style,
            position: response.position,
            maxMessageLength: response.max_words_per_message,
            botColor: response.bot_color,
            userColor: response.user_color,
            appearance: response.appearance,
            temperature: response.temperature,
            windowBgColor: response.window_bg_color || "#F9FAFB",
            welcomeMessage:
              response.welcome_message || "Hi there! How can I help you today?",
            inputBgColor: response.input_bg_color || "#FFFFFF",
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

  const updateMessageCount = () => {
    setMessageUsage((prev) => ({
      ...prev,
      used: prev.used + 1,
      remaining: Math.max(0, prev.limit - (prev.used + 1)),
    }));
  };

  const canSendMessage = () => {
    return messageUsage.remaining > 0;
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
      <div className="text-center text-gray-500 dark:text-white">
        No bot selected.
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

  const sendMessage = async () => {
    if (!canSendMessage()) {
      toast.error(
        "You have reached your message limit, please upgrade your plan."
      );
      return;
    }
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
      const data = await authApi.sendMessage(sessionId, "user", inputMessage);
      setBotMessageId(data.message_id);

      const thinkingDelay = Math.random() * 1000 + 500;
      setTimeout(() => {
        //setIsBotTyping(true);
        setIsBotTyping(true);
        setWaitingForBotResponse(false);
        setCurrentBotMessage("");
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

  const handleDeleteBot = async () => {
    if (!botToDelete) return;
    try {
      await authApi.deletebot(Number(botToDelete), { status: "Deleted" });
      toast.success("Bot deleted successfully!");
      setIsConfirmOpen(false);
      localStorage.removeItem("selectedBotId");
      setTimeout(() => navigate("/"), 3000);
    } catch (error) {
      console.error("Failed to delete bot:", error);
      toast.error("Failed to delete bot.");
    }
  };

  const handleSaveSettings = async () => {
    try {
      if (!userId) return;
      if (isBotExisting && botId) {
        await updateBotSettings(botId, userId, settings, setLoading);
      } else {
        await saveBotSettings(settings, userId, setLoading);
      }
      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings.");
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
    setSettings((prev) => ({ ...prev, [field]: value }));
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
          label: "Bot Icon",
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
          label: "Font Size",
          type: "select",
          value: settings.fontSize,
          options: ["12px", "14px", "16px", "18px"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("fontSize", e.target.value),
        },
        {
          label: "Font Style",
          type: "select",
          value: settings.fontStyle,
          options: ["Inter", "Roboto", "Open Sans", "Lato"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("fontStyle", e.target.value),
        },
      ],
    },
    {
      title: "Position",
      icon: Move,
      fields: [
        {
          label: "Chatbot Position",
          type: "select",
          value: settings.position,
          //options: ["top-left", "top-right", "bottom-left", "bottom-right"],
          options: ["bottom-left", "bottom-right", "top-right"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("position", e.target.value),
        },
      ],
    },
    {
      title: "Message Settings",
      icon: Palette,
      fields: [
        {
          label: "Max Message Length",
          type: "number",
          min: 100,
          max: 1000,
          value: settings.maxMessageLength,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("maxMessageLength", parseInt(e.target.value)),
        },
        {
          label: "Bot Message Color",
          type: "color",
          value: settings.botColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("botColor", e.target.value),
        },
        {
          label: "User Message Color",
          type: "color",
          value: settings.userColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("userColor", e.target.value),
        },
      ],
    },
    {
      title: "Window Appearance",
      icon: Palette,
      fields: [
        {
          label: "Welcome Message",
          type: "text",
          value: settings.welcomeMessage,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("welcomeMessage", e.target.value),
        },
        {
          label: "Window Background Color",
          type: "color",
          value: settings.windowBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("windowBgColor", e.target.value),
        },
        {
          label: "Input Box Background Color",
          type: "color",
          value: settings.inputBgColor,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("inputBgColor", e.target.value),
        },
      ],
    },
    {
      title: "Appearance & Behavior",
      icon: Sliders,
      fields: [
        {
          label: "Appearance",
          type: "select",
          value: settings.appearance,
          options: ["Popup", "Full Screen"],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            handleChange("appearance", e.target.value),
        },
        {
          label: "Temperature",
          type: "slider",
          min: 0,
          max: 1,
          step: "0.01",
          value: settings.temperature,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            handleChange("temperature", parseFloat(e.target.value));
          },
        },
      ],
    },
  ];

  if (!selectedBot) {
    return (
      <div className="text-center text-gray-500 dark:text-white">
        No bot selected.
      </div>
    );
  }

  return (
    <div>
      {loading && <Loader />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Customizing: {selectedBot.name}
        </h1>
        <div className="flex items-center gap-4">
          <button
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
          </button>
          {isConfirmOpen && (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg">
                <h2 className="text-lg font-semibold mb-4">Confirm Deletion</h2>
                <p>Do you wish to delete this bot?</p>
                <div className="mt-4 flex justify-end">
                  <button
                    className="bg-gray-300 text-black px-4 py-2 rounded mr-2"
                    onClick={() => setIsConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded"
                    onClick={handleDeleteBot}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}
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
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Panel */}
        <div className="space-y-6">
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 text-gray-900 dark:text-white"
            >
              <div className="flex items-center space-x-2 mb-4">
                <section.icon className="w-5 h-5 text-blue-500" />
                <h2 className="dark:text-white">{section.title}</h2>
              </div>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <div key={field.label}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.label}
                    </label>
                    {field.type === "select" ? (
                      <select
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "slider" ? (
                      <div className="relative w-full">
                        <input
                          type="range"
                          min={field.min}
                          max={field.max}
                          step={field.step}
                          value={field.value}
                          onChange={field.onChange}
                          className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <span
                          style={{
                            position: "absolute",
                            top: "-20px",
                            left: `calc(${
                              ((field.value - field.min) /
                                (field.max - field.min)) *
                              100
                            }% - 10px)`,
                            transform: "translateX(-50%)",
                          }}
                          className="text-sm font-semibold text-gray-900 dark:text-white"
                        >
                          {field.value}
                        </span>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        value={field.value}
                        min={field.min}
                        max={field.max}
                        accept={field.accept}
                        onChange={field.onChange}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 focus:ring-blue-500 focus:border-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Preview Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preview
            </h2>
            <div className="text-sm bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">
              Messages: {messageUsage.used}/{messageUsage.limit}
            </div>
          </div>

          {/* Chat Window */}
          <div
            ref={chatContainerRef}
            className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-[950px] overflow-y-auto flex flex-col"
            style={{
              backgroundColor: settings.windowBgColor,
            }}
          >
            {/* Bot Header */}
            <div style={headerStyle}>
              {settings.icon && (
                <img src={settings.icon} alt="Bot Icon" style={iconStyle} />
              )}
              <strong>{settings.name}</strong>
            </div>
            <div className="flex-1"></div>
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <div key={index} className="mb-4">
                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-lg max-w-[80%] ${
                      msg.sender === "user"
                        ? "ml-auto bg-blue-500 text-white"
                        : "mr-auto bg-gray-300 text-gray-900"
                    }`}
                    style={{
                      backgroundColor:
                        msg.sender === "user"
                          ? settings.userColor
                          : settings.botColor,
                      fontSize: settings.fontSize,
                      fontFamily: settings.fontStyle,
                    }}
                  >
                    <div>{msg.text}</div>
                  </div>

                  {/* Reaction Buttons BELOW the bubble, only for bot */}
                  {msg.sender === "bot" && (
                    <div className="flex gap-2 mt-1 ml-2">
                      <button
                        onClick={() => handleReaction("like", index)}
                        className={`p-1 rounded-full transition-colors ${
                          msg.reaction === "like"
                            ? "text-blue-500 fill-blue-500"
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
                className="mr-auto p-3 rounded-lg max-w-[80%] bg-gray-300 text-gray-900"
                style={{
                  backgroundColor: settings.botColor,
                  fontSize: settings.fontSize,
                  fontFamily: settings.fontStyle,
                }}
              >
                {settings.welcomeMessage}
              </div>
            )}
            {previewLoading && !isBotTyping && (
              <div className="mr-auto bg-gray-300 text-gray-900 p-3 rounded-lg max-w-[80%]">
                <span className="animate-pulse">...</span>
              </div>
            )}
            {isBotTyping && (
              <div
                className="mr-auto rounded-lg max-w-[80%] p-3"
                style={{
                  backgroundColor: settings.botColor,
                  fontSize: settings.fontSize,
                  fontFamily: settings.fontStyle,
                }}
              >
                {currentBotMessage}
                <span className="inline-flex items-center ml-1">
                  <span
                    className="h-1.5 w-1.5 bg-gray-600 rounded-full mx-0.5 animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  ></span>
                  <span
                    className="h-1.5 w-1.5 bg-gray-600 rounded-full mx-0.5 animate-bounce"
                    style={{ animationDelay: "200ms" }}
                  ></span>
                  <span
                    className="h-1.5 w-1.5 bg-gray-600 rounded-full mx-0.5 animate-bounce"
                    style={{ animationDelay: "400ms" }}
                  ></span>
                </span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="mt-4 flex items-center">
            <input
              type="text"
              className="flex-grow p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-black"
              style={{
                backgroundColor: settings.inputBgColor,
              }}
              placeholder={
                !canSendMessage()
                  ? "We are facing technical issue. Kindly reach out to website admin for assistance"
                  : "Type a message..."
              }
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
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
              className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
              onClick={sendMessage}
              disabled={
                !inputMessage.trim() ||
                !canSendMessage() ||
                waitingForBotResponse ||
                isBotTyping ||
                previewLoading
              }
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
