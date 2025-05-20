// ScriptGeneratePage.tsx
import { useState, useEffect } from "react";
import { useBot } from "../context/BotContext";
import { useNavigate } from "react-router-dom";
import { useLoader } from "../context/LoaderContext";
import { authApi } from "../services/api";
import type { BotSettings } from "../types";

export const ScriptGeneratePage = () => {
  const { selectedBot } = useBot();
  const [token, setToken] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const { setLoading } = useLoader();
  const [botId, setBotId] = useState<number | null>(null);
  const VITE_WIDGET_API_URL =
    import.meta.env.VITE_WIDGET_API_URL || "http://localhost:3000";
  const VITE_API_URL = import.meta.env.VITE_API_URL;
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
    headerBgColor: "#3B82F6",
    headerTextColor: "#FFFFFF",
    chatTextColor: "#1F2937",
    userTextColor: "#FFFFFF",
    buttonColor: "#3B82F6",
    buttonTextColor: "#FFFFFF",
    timestampColor: "#9CA3AF",
    borderRadius: "12px",
    borderColor: "#E5E7EB",
    chatFontFamily: "Inter",
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchToken = async () => {
      if (selectedBot?.id) {
        try {
          const response = await authApi.getBotToken(selectedBot.id); // Create this API method
          setToken(response.token);
        } catch (err) {
          console.error("Token fetch failed:", err);
        }
      }
    };
    fetchToken();
  }, [selectedBot]);

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
          console.log("botId from scriptGeneratepage", botId);

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

                    // ✅ Add these new fields
            headerBgColor: response.header_bg_color || "#3B82F6",
            headerTextColor: response.header_text_color || "#FFFFFF",
            chatTextColor: response.chat_text_color || "#1F2937",
            userTextColor: response.user_text_color || "#FFFFFF",
            buttonColor: response.button_color || "#3B82F6",
            buttonTextColor: response.button_text_color || "#FFFFFF",
            timestampColor: response.timestamp_color || "#9CA3AF",
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

  // Generate the script with dynamic bot ID and settings
  const generateScript = () => {
    if (!selectedBot?.id) {
      console.error("Bot ID is missing.");
      return "";
    }

    // const botId = selectedBot.id;

    return `<script
  src="${VITE_WIDGET_API_URL}/dist/chatbot-widget.iife.js"
  data-token="${token}"
  data-avatar-url="${settings.icon || ""}"
  data-position="${settings.position || ""}"
  data-welcome-message="${settings.welcomeMessage}"
  basedomain="${VITE_API_URL}"

></script>`;
  };

  const scriptContent = generateScript();

  const handleCopy = () => {
    if (scriptContent) {
      navigator.clipboard.writeText(scriptContent).then(() => {
        setCopySuccess("Copied!");
        setTimeout(() => setCopySuccess(""), 2000);
      });
    }
  };

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
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4 text-white">Copy Script</h2>
      <textarea
        value={scriptContent}
        readOnly
        rows={6}
        className="w-full p-2 border border-gray-300 rounded-lg bg-gray-100 text-sm"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleCopy}
          className="px-4 py-2 rounded-lg transition-colors bg-blue-500 hover:bg-blue-600 text-white"
        >
          Copy to Clipboard
        </button>
        {copySuccess && <span className="text-green-600">{copySuccess}</span>}
      </div>
      {/* <button
        onClick={() => navigate("/")}
        className="mt-4 bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      >
        Go Back
      </button> */}
    </div>
  );
};

export default ScriptGeneratePage;
