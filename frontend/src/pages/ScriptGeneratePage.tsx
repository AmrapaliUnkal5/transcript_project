// ScriptGeneratePage.tsx
import { useState, useEffect } from "react";
import { useBot } from "../context/BotContext";
import { useNavigate } from "react-router-dom";
import { useLoader } from "../context/LoaderContext";
import { authApi } from "../services/api";
import type { BotSettings } from "../types";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export const ScriptGeneratePage = () => {
  const { selectedBot } = useBot();
  const [token, setToken] = useState("");
  const [copySuccess, setCopySuccess] = useState("");
  const { setLoading } = useLoader();
  const [botId, setBotId] = useState<number | null>(null);
  const VITE_WIDGET_API_URL =
    import.meta.env.VITE_WIDGET_API_URL;
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
    welcomeMessage: "Hello! How can I help you?",
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
    userTimestampColor:"#FFFFFF",
  });
  const navigate = useNavigate();
  const [domain, setDomain] = useState("");
  const [isDomainSaved, setIsDomainSaved] = useState(false)
  const [domainError, setDomainError] = useState("");

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
              response.welcome_message || "Hello! How can I help you?",
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
            userTimestampColor: response.userTimestampColor || "#FFFFFF",
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
  const fetchBotDomain = async () => {
    if (!selectedBot?.id) return;

    try {
      const domainData = await authApi.getBotDomain(selectedBot.id);
      if (domainData?.domain) {
        setDomain(domainData.domain); // Pre-fill the input box
        setIsDomainSaved(true);       // Show the Copy Script section
      }
    } catch (err) {
      console.error("Failed to fetch domain:", err);
    }
  };

  fetchBotDomain();
}, [selectedBot]);

  // Generate the script with dynamic bot ID and settings
  const generateScript = () => {
    if (!selectedBot?.id) {
      console.error("Bot ID is missing.");
      return "";
    }

    // const botId = selectedBot.id;

    return `<script
  src="${VITE_WIDGET_API_URL}"
  data-token="${token}"
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
  const handleSaveDomain = async () => {
  const trimmedDomain = domain.trim();

  // Simple URL regex (basic structure check)
  const urlPattern = /^(https?:\/\/)(localhost:\d{1,5}|([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(:\d{1,5})?(\/.*)?$/;

  if (!trimmedDomain) {
    setDomainError("Domain is required.");
    setIsDomainSaved(false);
    return;
  }

  if (!urlPattern.test(trimmedDomain)) {
    setDomainError("Please enter a valid domain starting with http:// or https://");
    setIsDomainSaved(false);
    return;
  }

   try {
    // Clear previous error
    setDomainError("");
     if (!selectedBot?.id) {
          console.error("Bot ID is missing.");
          return;
        }

    // 🔁 Call API to update domain in backend
    await authApi.updateBotDomain(selectedBot?.id, trimmedDomain);
    toast.success("Domain Saved Successfully");

    // ✅ Indicate success
    setIsDomainSaved(true);
    
  } catch (error) {
    console.error("Failed to save domain:", error);
    setDomainError("Failed to save domain. Please try again.");
    setIsDomainSaved(false);
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
    
    <div className="p-4 text-black" >
      
    <ToastContainer position="top-right" autoClose={5000}  />
    <h2  style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "24px",
    color: "#333333",
    fontWeight: "bold",
    marginBottom: "16px"
  }}> Bot Name: {selectedBot.name}</h2>

    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-10"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}
>
    <h3 style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "20px",
    color: "#333333",
    fontWeight: "bold",
    marginBottom: "10px",
    
    
  }}  >Direct Link </h3>
   <p className=" mb-4" style={{  fontFamily: "Instrument Sans, sans-serif",fontSize: "16px" ,fontWeight: "400"}}>
  Share access to your chatbot by using the link below:
</p>
    <div className="flex items-center gap-2 mb-4">
      <input
        type="text"
        readOnly
        value={`${VITE_API_URL.replace(/\/$/, "")}/bot/${token}`}
        className="flex-1 p-2 border border-gray-300 rounded-lg bg-white text-black text-sm"
      />
      <button
        onClick={() => {
          navigator.clipboard.writeText(
            `${VITE_API_URL.replace(/\/$/, "")}/bot/${token}`
          );
          toast.success("Link copied!");
        }}
        className="w-[118px] h-[40px] px-4 py-2 bg-[#5348CB] text-white rounded-lg hover:bg-[#4339b6] transition-colors"
         style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "14px" }}
      >
        Copy Link
      </button>

      </div>
    </div>
    <p></p>
    <p></p>
    <p></p>

    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-10"
  style={{
    border: '1px solid #DFDFDF',
    borderRadius: '13px'
  }}>
      <h3 style={{
    fontFamily: "Instrument Sans, sans-serif",
    fontSize: "20px",
    color: "#333333",
    fontWeight: "bold",
    marginBottom: "10px",
    
    
  }}>Add to a website</h3>

      <div className="mb-4">
      <p className="mb-4 text-sm" style={{  fontFamily: "Instrument Sans, sans-serif",fontSize: "16px" ,fontWeight: "400"}}>Website you would like the widget to be placed:</p>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value);
            setDomainError("");
          }}
          placeholder="e.g., https://example.com"
          className="flex-1 p-2 border border-gray-400 rounded-lg bg-white text-black placeholder-gray-500"
        />
        <button
          onClick={handleSaveDomain}
          className="w-[100px] h-[40px] px-4 py-2 bg-[#5348CB] text-white rounded-lg hover:bg-[#4339b6] transition-colors"
          style={{ fontFamily: "Instrument Sans, sans-serif", fontSize: "14px" }}
        >
          Save 
        </button>
      </div>
      {domainError && (
        <p className="text-red-400 text-sm mt-1">{domainError}</p>
      )}
    </div>

      

      {isDomainSaved && (
  <>
    {/* 1) ADD THE DIRECT LINK SECTION */}
    

    {/* 2) RENAME “Copy Script” → “Add to a Website” and update copy text */}
    
    <p className="mb-2 text-sm">
      Add the code below to your Website:
    </p>
    <textarea
      value={scriptContent}
      readOnly
      rows={6}
      className="w-full p-2 border border-gray-300 rounded-lg bg-gray-800 text-white text-sm mb-2"
    />
    <div className=" flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
      >
        Copy Code
      </button>
      {copySuccess && <span className="text-blue-400">{copySuccess}</span>}
    </div>
  </>
)}</div>
    </div>

  );
};


export default ScriptGeneratePage;
