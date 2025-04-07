import React, { useState, useEffect } from "react";
import { Type, Move, MessageSquare, Palette, Sliders } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { BotSettings } from "../types";
import { authApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "../index.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useBot } from "../context/BotContext";
import { useLoader } from "../context/LoaderContext"; // Use global loader hook
import Loader from "../components/Loader";

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
    font_size: parseInt(settings.fontSize), // Assuming fontSize is a string like "14px"
    position: settings.position,
    bot_color: settings.botColor,
    user_color: settings.userColor,
    max_words_per_message: settings.maxMessageLength,
    is_active: true, // Assuming the bot should be active by default
    appearance: settings.appearance,
    temperature: settings.temperature,
  };

  try {
    setLoading(true); // Show loader
    //const response = await authApi.post("/botsettings", data);
    const response = await authApi.saveBotSettings(data);
    console.log("Full response:", response);
    console.log("Settings saved successfully:", response.data);
    return response.data;
  } catch (error) {
    console.error("Failed to save settings:", error);
    throw error;
  } finally {
    setLoading(false); // ✅ Hide loader after API call
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
    setLoading(false); //
  }
};

export const ChatbotCustomization = () => {
  const { loading, setLoading } = useLoader();
  const { user } = useAuth(); // Get user data from context
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
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>(
    []
  );
  const [inputMessage, setInputMessage] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false); // Separate loader for chat preview

  if (!selectedBot) {
    return <div className="text-center text-gray-500 dark:text-white">No bot selected.</div>;
  }

  const handleDeleteBot = async () => {
    if (!botToDelete) return;

    try {
      console.log("botToDelete", botToDelete);
      await authApi.deletebot(Number(botToDelete), { status: "Deleted" });
      toast.success("Bot deleted successfully!");
      setIsConfirmOpen(false);
      localStorage.removeItem("selectedBotId"); // Remove botId from localStorage
      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error) {
      console.error("Failed to delete bot:", error);
      toast.error("Failed to delete bot.");
    }
  };

  useEffect(() => {
    console.log("slelelct bit", selectedBot);

    if (selectedBot) {
      startChatSession();
    }
  }, [selectedBot]);

  /** ✅ Start Chat Session */
  const startChatSession = async () => {
    if (!selectedBot || !userId) return;
    setPreviewLoading(true); // ✅ Show "..." in preview only
    try {
      const data = await authApi.startChat(selectedBot.id, userId);
      setInteractionId(data.interaction_id);
      fetchChatMessages(data.interaction_id);
    } catch (error) {
      console.error("Failed to start chat session:", error);
    } finally {
      setPreviewLoading(false); // ✅ Hide "..." after fetching messages
    }
  };

  const fetchChatMessages = async (interactionId: number) => {
    try {
      setPreviewLoading(true);
      const data = await authApi.getChatMessages(interactionId);

      if (Array.isArray(data)) {
        // ✅ Convert "message" to "text" to match the expected format
        const formattedMessages = data.map((msg) => ({
          sender: msg.sender,
          text: msg.message, // ✅ Correctly map "message" to "text"
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]); // ✅ If API returns an error or no messages
      }
    } catch (error) {
      console.error("Failed to fetch chat messages:", error);
      setMessages([]);
    } finally {
      setPreviewLoading(false); // ✅ Hide "..." after fetching messages
    }
  };

  /** ✅ Send Message */
  const sendMessage = async () => {
    console.log("sendmessage");
    if (!interactionId || !inputMessage.trim()) return;

    // ✅ Immediately add user message to UI
    const newMessages = [...messages, { sender: "user", text: inputMessage }];
    setMessages(newMessages);
    setInputMessage("");
    setPreviewLoading(true); // Use global loading state

    try {
      const data = await authApi.sendMessage(
        interactionId,
        "user",
        inputMessage
      );

      // ✅ Add bot response to UI
      const botMessage = { sender: "bot", text: data.message };
      setMessages([...newMessages, botMessage]);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setPreviewLoading(false); // ✅ Hide loader after bot responds
    }
  };

  //console.log("User ID in ChatbotCustomization:", userId);
  const [settings, setSettings] = useState<BotSettings>({
    name: "Support Bot",
    icon: "https://images.unsplash.com/photo-1531379410502-63bfe8cdaf6f?w=200&h=200&fit=crop&crop=faces",
    fontSize: "16px",
    fontStyle: "Inter",
    position: "top-left", // changed as per new req
    maxMessageLength: 500,
    botColor: "#E3F2FD",
    userColor: "#F3E5F5",
    appearance: "Popup",
    temperature: 0,
  });

  const [isBotExisting, setIsBotExisting] = useState<boolean>(false);
  const [botId, setBotId] = useState<number | null>(null);

  // Fetch bot settings on component mount
  useEffect(() => {
    const fetchBotSettings = async () => {
      setLoading(true);
      try {
        // if (!userId) {
        //   console.error("User ID is missing.");
        //   return;
        // }
        if (!selectedBot.id) {
          console.error("Bot ID is missing.");
          return;
        }
        const botId = selectedBot.id;

        // console.log("Fetching bot settings for user_id:", userId);
        //const response = await authApi.getBotSettingsByUserId(userId);
        // console.log("Full response:", response);
        console.log("Fetching bot settings for bot_id:", botId);
        const response = await authApi.getBotSettingsBotId(botId); // New API call
        console.log("Response1:", response);

        if (response) {
          //const firstBotData = Object.values(response[0])[0]; // Get first bot from response
          //console.log("First Bot Data:", firstBotData);
          // The bot_id is the key of the first object, so extract it dynamically
          // const botId = Number(Object.keys(response[0])[0]);
          //console.log("First Bot id :", botId);
          setBotId(selectedBot.id);
          //setBotId(firstBotData.bot_id); // Assuming bot_id is returned
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
          });
        } else {
          console.log("No bots found. Using default settings.");
        }
      } catch (error) {
        console.error("Failed to fetch bot settings:", error);
      } finally {
        setLoading(false); // Hide loader after API call
      }
    };

    fetchBotSettings();
  }, [botId]);

  const handleSaveSettings = async () => {
    console.log("handle Save");
    console.log("user Id handle Save", userId);
    try {
      if (!userId) {
        //alert("User ID is missing. Please log in again.");
        return;
      }
      console.log("isBotexisting", isBotExisting);
      console.log("botId", botId);

      if (isBotExisting && botId) {
        await updateBotSettings(botId, userId, settings, setLoading); // Update the bot settings if bot exists
      } else {
        await saveBotSettings(settings, userId, setLoading); // Save new bot settings if bot doesn't exist
      }

      //alert("Settings saved successfully!");
      toast.success("Settings saved successfully!"); // Success message
    } catch (error) {
      console.error(error);
      //alert("Failed to save settings.");
      toast.error("Failed to save settings."); // Error message
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      handleIconUpload(file);
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
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
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
      // Check if the file size is greater than 1MB.
      if (file.size > 1024 * 1024) {
        console.log("Original file size:", file.size);
        const compressedFile = await compressImage(file);
        console.log("Compressed file size:", compressedFile.size);
        file = compressedFile; // Use the compressed file
      }
      const formData = new FormData();
      formData.append("file", file);
      const response = await authApi.uploadBotIcon(formData); // API call to upload image

      console.log("Upload response:", response);

      const uploadedUrl = response.url; // Assuming the response contains the uploaded URL
      console.log("uploadedUrl", uploadedUrl);
      handleChange("icon", uploadedUrl); // Save URL in state
    } catch (error) {
      console.error("Failed to upload bot icon:", error);
      toast.error("Failed to upload bot icon.");
    } finally {
      setLoading(false); // Hide loader after the API call
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
          label: "Chatbot  Position",
          type: "select",
          value: settings.position,
          options: ["top-left", "top-right", "bottom-left", "bottom-right"],
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
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
      title: "Appearance & Behavior",
      icon: Sliders,
      fields: [
        {
          label: "Appearance",
          type: "select",
          value: settings.appearance,
          options: ["Popup", "Full Screen"],

          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            handleChange("appearance", e.target.value),
        },
        {
          label: "Temperature",
          type: "slider",
          min: 0,
          max: 1,
          step: "0.01",

          value: settings.temperature, // Controlled state

          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const newTemperature = parseFloat(e.target.value);
            setSettings((prev) => ({ ...prev, temperature: newTemperature })); // Update settings
          },
        },
      ],
    },
  ];

  const getPositionStyles = (position: string) => {
    switch (position) {
      case "top-left":
        return { top: "10%", left: "10%", transform: "translate(0, 0)" };
      case "top-right":
        return { top: "10%", right: "10%", transform: "translate(0, 0)" };
      case "bottom-left":
        return { bottom: "10%", left: "10%", transform: "translate(0, 0)" };
      case "bottom-right":
        return { bottom: "10%", right: "10%", transform: "translate(0, 0)" };
      default:
        return { bottom: "10%", right: "10%", transform: "translate(0, 0)" }; // Default to bottom-right
    }
  };

  return (
    <div className="space-y-6">
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
          {/* Confirmation Modal */}
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
                <h2 className="dark:text-white">
                  {section.title}
                </h2>
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
                        {/* Display the current value above the slider's knob */}
                        <span
                          style={{
                            position: "absolute",
                            top: "-20px", // Adjust this value to position the span above the knob
                            left: `calc(${
                              ((field.value - field.min) /
                                (field.max - field.min)) *
                              100
                            }% - 10px)`, // Calculate the knob's position
                            transform: "translateX(-50%)", // Center the span above the knob
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Preview
          </h2>

          {/* Chat Window */}
          <div className="relative bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-80 overflow-y-auto flex flex-col">
            {/* Chat Messages */}
            {messages.length > 0 ? (
              messages.map((msg, index) => (
                <div
                  key={index}
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
                  {msg.text}
                </div>
              ))
            ) : (
              <p className="text-white text-center mt-auto">
                Start chatting with the bot!
              </p>
            )}

            {previewLoading && (
              <div className="mr-auto bg-gray-300 text-gray-900 p-3 rounded-lg max-w-[80%]">
                <span className="animate-pulse">...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="mt-4 flex items-center">
            <input
              type="text"
              className="flex-grow p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 text-gray-900 dark:text-white"
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputMessage.trim()) {
                  sendMessage();
                }
              }}
            />
            <button
              className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              onClick={sendMessage}
              disabled={!inputMessage.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
