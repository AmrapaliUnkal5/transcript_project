declare global {
  interface Window {
    hideChatbotWidget?: () => void;
  }
}
import React, {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import axios from "axios";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import "./chatbot-widget.css";

interface BotSettings {
  user_id?: number; // Optional user_id, if available from backend
  bot_name: string;
  bot_icon?: string;
  font_style?: string;
  font_size?: number;
  position?: string;
  max_words_per_message?: number;
  is_active?: boolean;
  bot_color?: string;
  user_color?: string;
  appearance?: string;
  temperature?: number;
  status?: string;
  embedding_model_id?: number;
  llm_model_id?: number;
  window_bg_color?: string;
  welcome_message?: string;
  input_bg_color?: string;

  // New customization fields
  header_bg_color?: string;
  header_text_color?: string;
  chat_text_color?: string;
  user_text_color?: string;
  button_color?: string;
  button_text_color?: string;
  timestamp_color?: string;
  border_radius?: string;
  border_color?: string;
  chat_font_family?: string;
  lead_generation_enabled?: boolean;
  lead_form_fields?: Array<"name" | "email" | "phone" | "address">;
}

interface ChatbotWidgetProps {
  botId: string;
  closeWidget: () => void; // Function to close the widget
  baseDomain: string;
  appearance?: string;
}

export interface ChatbotWidgetHandle {
  endSession: () => Promise<void>;
}

const ChatbotWidget = forwardRef<ChatbotWidgetHandle, ChatbotWidgetProps>(
  ({ botId, closeWidget, baseDomain, appearance: widgetAppearance }, ref) => {
    const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
    const isDirectLink = !!widgetAppearance; // If widgetAppearance exists, it's a direct link
    const isFullScreen = isDirectLink || botSettings?.appearance === "Full Screen";
    const [messages, setMessages] = useState<
      {
        sender: "user" | "bot";
        message: string;
        message_id?: number;
        reaction?: "like" | "dislike";
        is_greeting?: boolean;
        sources?: Array<{
          file_name: string;
          source: string;
          content_preview: string;
          website_url: string;
          url: string;
        }>;
        showSources?: boolean;
      }[]
    >([]);
    const [inputMessage, setInputMessage] = useState("");
    const sessionIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    //const [interactionId, setInteractionId] = useState<number | null>(null);
    const [isBotTyping, setIsBotTyping] = useState(false); // New state for typing animation
    const [currentBotMessage, setCurrentBotMessage] = useState<string>("");
    const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    // const [welcomeMessageIndex, setWelcomeMessageIndex] = useState<
    //   number | null
    // >(null);
    //const [showWelcomeBubble] = useState(true);
    const [usageError, setUsageError] = useState("");
    const [isSendDisabled, setIsSendDisabled] = useState(false);
    const [hasWelcomeBeenShown, setHasWelcomeBeenShown] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const [hasWhiteLabeling, setHasWhiteLabeling] = useState(false);

      //for capturing user data
    const [userName, setUserName] = useState("");
    const [userEmail, setUserEmail] = useState("");
    const [userPhone, setUserPhone] = useState("");
    const [userAddress, setUserAddress] = useState("");
    const [formSubmitted, setFormSubmitted] = useState(false);
    const [emailError, setEmailError] = useState("");
    const widgetdomain = import.meta.env.VITE_WIDGET_DOMAIN;
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // At top level of your component
    const userIdRef = useRef<string | null>(null);
//This is to create the unique userId for first and save in his local storage, it will be saved in his
    useEffect(() => {
      let storedUserId = localStorage.getItem("botUserId");
      if (!storedUserId) {
        storedUserId = crypto.randomUUID();  // or use a hash based on IP/device/etc.
        localStorage.setItem("botUserId", storedUserId);
      }
      userIdRef.current = storedUserId;
      console.log("User ID:", userIdRef.current);
    }, []);

    useEffect(() => {
      const fetchBotSettings = async () => {
        console.log("baseDomain", baseDomain);
        try {
          console.log("botId",botId)
          const response = await axios.get<BotSettings>(
            `${baseDomain}/widget/bot`, // No botId in URL
            {
              headers: {
                Authorization: `Bot ${botId}`,
              },
            }
          );
          console.log("response", response);
          console.log("lead_form_fields from API:", response.data.lead_form_fields);
          setBotSettings(response.data);
        } catch (error) {
          console.error("Error fetching bot settings:", error);
        }
      };

      fetchBotSettings();
    }, [botId]);

    //check add ons // Check White-Labeling Addon
    useEffect(() => {
      const checkWhiteLabelingAddon = async () => {
        try {
          // Call the API that checks if the user has the White-Labeling addon
          const response = await axios.get(
            `${baseDomain}/api/user/addon/white-labeling-check`,
            {
              headers: {
                Authorization: `Bot ${botId}`,
              },
            }
          );
          console.log("White-Labeling response", response);
          setHasWhiteLabeling(response.data.hasWhiteLabeling);
        } catch (error) {
          console.error("Error checking White-Labeling addon", error);
          setHasWhiteLabeling(false);
        }
      };

      if (botId) {
        checkWhiteLabelingAddon();
      }
    }, [botId]); // Re-run if userId changes

    useEffect(() => {
      if (
        botSettings?.welcome_message &&
        !hasWelcomeBeenShown &&
        messages.length === 0
      ) {
        const welcomeMsg = {
          sender: "bot" as const, // make sure TypeScript infers the literal
          message: botSettings.welcome_message,
          reaction: undefined,
        };
        setMessages([welcomeMsg]);
        setHasWelcomeBeenShown(true);
      }
    }, [botSettings, hasWelcomeBeenShown, messages.length]);

    useEffect(() => {
      const sendEndRequest = () => {
        if (!sessionIdRef.current) return;

        fetch(`${baseDomain}/widget/interactions/${sessionIdRef.current}/end`, {
          method: "PUT",
          keepalive: true,
        });
        sessionIdRef.current = null;
      };

  // Only use pagehide — fired reliably on tab close, back, reload
  window.addEventListener("pagehide", sendEndRequest);

  resetIdleTimer(); // keep your idle timeout

      return () => {
        window.removeEventListener("pagehide", sendEndRequest);
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      };
    }, [baseDomain]);

    useEffect(() => {
      const style = document.createElement("style");
      style.innerHTML = `
      @keyframes bounce {
        0%, 80%, 100% {
          transform: scale(0);
        } 
        40% {
          transform: scale(1);
        }
      }
    `;
      document.head.appendChild(style);
      return () => {
        document.head.removeChild(style);
      };
    }, []);

    useEffect(() => {
      window.hideChatbotWidget = () => {
        const container = document.getElementById("chatbot-widget-container");
        if (container) {
          container.style.display = "none";
        }
      };

      return () => {
        delete window.hideChatbotWidget;
      };
    }, []);

    useEffect(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    }, [messages, isBotTyping]);

    // const chatEndRef = useRef<HTMLDivElement | null>(null);

    // useEffect(() => {
    //   chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // }, [messages]);

    // Add this utility function at the top of your component file
      const getContrastColor = (bgColor?: string) => {
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

    const sendMessage = async () => {
      const trimmedMessage = inputMessage.trim();
      if (!trimmedMessage) return;
      console.log("I am here sendMessage");

      const quotaResponse = await axios.get(
        `${baseDomain}/api/usage/messages/check`,
        {
          headers: {
            Authorization: `Bot ${botId}`,
          },
        }
      );
      if (!quotaResponse.data.canSendMessage) {
        setUsageError(
          "We are facing technical issue. Kindly reach out to website admin for assistance."
        );
        setIsSendDisabled(true);
        return;
      }

      console.log(
        "quotaResponse.data.hasWhiteLabelling",
        quotaResponse.data.hasWhiteLabelling
      );

      // Clear error if they are allowed again (if this check is ever reused)
      setUsageError("");
      setIsSendDisabled(false);

      setMessages((prev) => [
        ...prev,
        { sender: "user", message: trimmedMessage },
      ]);
      setInputMessage("");
      resetIdleTimer();
      console.log("Current session ID:", sessionIdRef.current);

      try {
        if (!sessionIdRef.current) {
          const startResponse = await axios.post(
            `${baseDomain}/widget/start_chat`,
            { session_id: userIdRef.current },
            {
              headers: {
                Authorization: `Bot ${botId}`,
              },
            }
          );
          sessionIdRef.current = startResponse.data.interaction_id;
        }
        console.log("start_chat InteractionId", sessionIdRef.current);

        // Show typing dots (e.g., "...") for a short time
        setIsBotTyping(true);
        setCurrentBotMessage(""); // Clear any previous message
        console.log("setCurrentBotMessage", currentBotMessage);
        await new Promise((r) => setTimeout(r, 300));

        // Simulate typing dots animation (repeating "...")
        // let dots = "";
        // const dotInterval = setInterval(() => {
        //   dots = dots.length < 3 ? dots + "." : "";
        //   setCurrentBotMessage(dots);
        // }, 500);

        const response = await axios.post(`${baseDomain}/widget/send_message`, {
          interaction_id: sessionIdRef.current,
          sender: "user",
          message_text: trimmedMessage,
        });
        console.log("responsesend_message ", response);

        setCurrentBotMessage("");
        
        const botReply = response.data.message;
        const botMessageId = response.data.message_id;
        const sources = response.data.sources || [];

        if (response.data.error) {
          setUsageError(
            "We are facing a technical issue. Kindly reach out to the website admin for assistance."
          );
          setIsSendDisabled(true);
          return;
        }

        // Simulate character-by-character typing effect for the bot's reply
        let index = 0;
        let displayedMessage = "";
        const typeInterval = setInterval(() => {
          if (index < botReply.length) {
            displayedMessage += botReply[index];
            setCurrentBotMessage(displayedMessage);
            index++;
          } else {
            clearInterval(typeInterval);
            setMessages((prev) => [
              ...prev,
              { 
                sender: "bot", 
                message: botReply, 
                message_id: botMessageId,
                sources: sources,
                showSources: false
              },
            ]);
            setCurrentBotMessage("");
            setIsBotTyping(false);
          }
        }, 30);
      } catch (error) {
        console.error("Failed to send message:", error);
        setMessages((prev) => [
          ...prev,
          { sender: "bot", message: "Sorry, something went wrong." },
        ]);
        setIsBotTyping(false);
        setCurrentBotMessage("");
      }
    };
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleReaction = async (type: "like" | "dislike", index: number) => {
      console.log("handleReaction");
      console.log("index", index);
      const message = messages[index];
      console.log("Message at index", index, message);
      const messageId = message?.message_id;

      if (!messageId) {
        console.error("No message_id found for this index");
        return;
      }

      const interaction_id = sessionIdRef.current;
      //const user_id = null;
      console.log("interaction_ids", interaction_id);
      console.log("botId", botId);

      //if (!interaction_id || !botId) return;

      try {
        const response1 = await fetch(
          `${baseDomain}/widget/interactions/reaction`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              Authorization: `Bot ${botId}`,
            },
            body: JSON.stringify({
              interaction_id: interaction_id,
              session_id: userIdRef.current,
              reaction: type,
              message_id: messageId,
            }),
          }
        );

        if (!response1.ok) {
          throw new Error(`HTTP error! status: ${response1.status}`);
        }

        const result = await response1.json();
        console.log("Reaction API response:", result);

        setMessages((prev) =>
          prev.map((msg, i) => {
            if (i !== index) return msg;

            // Toggle off if same reaction is clicked again
            if (msg.reaction === type) {
              return { ...msg, reaction: undefined };
            }

            return { ...msg, reaction: type };
          })
        );
      } catch (error) {
        console.error("Failed to submit reaction:", error);
      }
    };

    // Reuse your sessionIdRef
    const endSession = async () => {
      console.log("Ending Session...");
      console.log("Session ID:", sessionIdRef.current);
      if (sessionIdRef.current) {
        try {
          await axios.put(
            `${baseDomain}/widget/interactions/${sessionIdRef.current}/end`
          );
          console.log("Session ended successfully");
        } catch (err) {
          console.error("Failed to end session:", err);
        } finally {
          sessionIdRef.current = null;
        }
      }
    };
    // Expose endSession via ref
    useImperativeHandle(ref, () => ({
      endSession,
    }));

    // Call this to reset the idle timer
    const resetIdleTimer = () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      idleTimeoutRef.current = setTimeout(() => {
        endSession();
        sessionIdRef.current = null;
      }, 60 * 60 * 1000);
    };

    if (!botSettings) return <div>Loading chatbot...</div>;

    const {
      bot_name,
      bot_icon,
      font_style,
      font_size,
      bot_color,
      user_color,
      position,
      window_bg_color,
      header_bg_color,
      header_text_color,
      user_text_color,
      chat_text_color,
      button_color,
      button_text_color,
      chat_font_family,
      border_radius,
      border_color,
      lead_generation_enabled,
      lead_form_fields,
    } = botSettings;

    const [vertical, horizontal] = (position || "bottom-right").split("-");
    const MAX_USER_MESSAGE_LENGTH = 1000;
    const hasLeadFields = (lead_form_fields ?? []).length > 0;

    // Log the position values
    // console.log("Bot position:", position);
    // console.log("Vertical position:", vertical);
    // console.log("Horizontal position:", horizontal);

    // const widgetStyle: React.CSSProperties = {
    //   fontFamily: font_style || "Arial, sans-serif",
    //   fontSize: font_size ? `${font_size}px` : "14px",
    //   position: "fixed",
    //   ...(vertical === "top" ? { top: "110px" } : { bottom: "110px" }),
    //   ...(horizontal === "left" ? { left: "20px" } : { right: "20px" }),
    //   width: "320px",
    //   height: "460px",
    //   // backgroundColor: "#fff",
    //   border: `2px solid ${bot_color || "#333"}`,
    //   borderRadius: "10px",
    //   boxShadow: "0 0 10px rgba(0,0,0,0.2)",
    //   display: "flex",
    //   flexDirection: "column",
    //   overflow: "hidden",
    //   zIndex: 9999,
    //   backgroundColor: window_bg_color || "#F9FAFB",
    // };

    const widgetStyle: React.CSSProperties = {
      fontFamily: chat_font_family || font_style,
      fontSize: font_size ? `${font_size}px` : "14px",
      position: "fixed",
      zIndex: 2147483647,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      ...(isFullScreen
        ? {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            backgroundColor: window_bg_color || "#F9FAFB",
            border: "none",
            borderRadius: border_radius || "20px",
            boxShadow: "none",
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
            '@media (max-width: 768px)': {
              fontSize: font_size ? `${font_size * 0.9}px` : "13px",
            }
          }
        : {
            ...(vertical === "top" ? { top: "110px" } : { bottom: "90px" }),
            ...(horizontal === "left" ? { left: "20px" } : { right: "20px" }),
            width: "380px",
            maxWidth: "calc(100dvw - 40px)",
            height: "600px",
            maxHeight: "calc(100dvh - 140px)",
            backgroundColor: window_bg_color || "#F9FAFB",
            border: `1px solid ${border_color || "#E5E7EB"}`,
            borderRadius: border_radius || "12px",
            boxShadow:
              "rgba(0, 0, 0, 0.2) 5px 5px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px",
            '@media (max-width: 768px)': {
                width: "calc(100vw - 40px)",
                height: "70vh",
                ...(vertical === "top" ? { top: "20px" } : { bottom: "20px" }),
                ...(horizontal === "left" ? { left: "20px" } : { right: "20px" }),
              }
          }),
    };

    const headerStyle: React.CSSProperties = {
      backgroundColor: header_bg_color || "#3B82F6",
      color: header_text_color || "#fff",
      padding: "10px",
      display: "flex",
      alignItems: "center",
      fontSize: "18px",
      gap: "8px",
      fontWeight: 600,
      fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif`,
    };

    const iconStyle: React.CSSProperties = {
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      objectFit: "cover",
    };

    const chatBodyStyle: React.CSSProperties = {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: "10px",
      overflowY: "auto",
      backgroundColor: window_bg_color || "#f9f9f9",
      height: "calc(100% - 120px)",
    };

    // const inputStyle: React.CSSProperties = {
    //   display: "flex",

    //   padding: "16px", // equivalent to p-4
    //   borderTop: `1px solid ${border_color || "#E5E7EB"}`,
    //   alignItems: "center",
    //   backgroundColor: "#ffffff",
    //   gap: "0.5rem", // similar to spacing between input and button in Tailwind
    // };

    // const timestampStyle: React.CSSProperties = {
    //   fontSize: "11px",
    //   marginTop: "4px",
    //   textAlign: "right",
    //   color: timestamp_color || "#9CA3AF",
    // };

    // const inputBoxStyle: React.CSSProperties = {
    //   flex: 1,
    //   padding: "8px",
    //   border: "1px solid #ccc",
    //   borderRadius: "4px",
    //   fontSize: "14px",
    // };

    return (
      <div ref={chatContainerRef} style={widgetStyle}>
        {!isDirectLink && (
          <div
            style={{
              position: "absolute",
              top: `calc(10px + env(safe-area-inset-top, 0px)`,
              right: `calc(10px + env(safe-area-inset-right, 0px)`,
              fontSize: chat_font_family ? `${font_size}px` : "14px",
              color: "#fff",
              cursor: "pointer",
              zIndex: 1,
            }}
            onClick={() => {
              endSession();
              closeWidget();
            }}
          >
            ✕
          </div>
        )}
        <div style={headerStyle}>
         <img
              src={
                !bot_icon || bot_icon === "/images/bot_1.png"
                  ? `${widgetdomain}/images/bot_1.png`
                  : bot_icon
              }
              alt="Bot Icon"
              style={iconStyle}
            />
          {bot_name}
        </div>

        <div style={chatBodyStyle}>
          <div style={{ marginTop: "auto" }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ marginBottom: "16px" }}>
                {/* Message Bubble */}
                <div
                  style={{
                    padding: "12px",
                    borderRadius: border_radius || "20px",
                    maxWidth: "80%",
                    backgroundColor:
                      msg.sender === "user"
                        ? user_color || "#3b82f6"
                        : bot_color || "#e5e7eb",
                    color:
                      msg.sender === "user"
                        ? user_text_color || "#ffffff"
                        : chat_text_color || "#111827",
                    fontSize: font_size ? `${font_size}px` : "14px",
                    fontFamily: chat_font_family || font_style,
                    wordBreak: "break-word",
                    marginLeft: msg.sender === "user" ? "auto" : "0px",
                    marginRight: msg.sender === "user" ? "0px" : "auto",
                  }}
                >
                  <div>{msg.message}</div>
                  <div style={{
                    fontSize: "11px",
                    marginTop: "4px",
                    textAlign: "right",
                    color: msg.sender === "user"
                      ? user_text_color || "#ffffff"
                      : chat_text_color || "#111827"
                  }}>
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Reaction Buttons and Sources Toggle */}
                {msg.sender === "bot" && index !== 0 && (
                  <div
                    style={{
                      marginTop: "4px",
                      display: "flex",
                      gap: "8px",
                      marginLeft: "6px",
                    }}
                  >
                    <button
                      onClick={() => handleReaction("like", index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: msg.reaction === "like" ? "#22c55e" : "#6b7280",
                        padding: "4px",
                        borderRadius: "50%",
                      }}
                    >
                      <ThumbsUp size={16} />
                    </button>
                    <button
                      onClick={() => handleReaction("dislike", index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color:
                          msg.reaction === "dislike" ? "#ef4444" : "#6b7280",
                        padding: "4px",
                        borderRadius: "50%",
                      }}
                    >
                      <ThumbsDown size={16} />
                    </button>
                    <button
                onClick={() => {
                  navigator.clipboard.writeText(msg.message);
                  setCopiedIndex(index);
                  setTimeout(() => setCopiedIndex(null), 1500);
                }}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#6b7280",
                  fontSize: "12px",
                  padding: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {copiedIndex === index ? (
                  "Copied!"
                ) : (
                  <>
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

                    
                    {/* View Sources button */}
                    {msg.sources && msg.sources.length > 0 && !msg.is_greeting && (
                      <button 
                        onClick={() => toggleSources(index)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#3b82f6",
                          fontSize: "12px",
                          padding: "4px",
                        }}
                      >
                        {msg.showSources ? 'Hide Sources' : 'View Sources'}
                      </button>
                    )}
                  </div>
                )}

                {/* Sources display */}
                {msg.showSources && msg.sources && msg.sources.length > 0 && !msg.is_greeting && (
                  <div style={{
                    marginTop: "8px",
                    padding: "8px",
                    backgroundColor: "rgba(0,0,0,0.05)",
                    borderRadius: "8px",
                    fontSize: "12px"
                  }}>
                    <ul style={{ listStyleType: "none", paddingLeft: 0 }}>
                      {msg.sources.map((source, idx) => (
                        <li key={idx} style={{ marginBottom: "8px" }}>
                          {source.source === 'upload' && (
                            <>
                              <div style={{ fontWeight: "bold" }}>Source Type: Files</div>
                              <div>File Name: {source.file_name}</div>
                            </>
                          )}
                          {source.source === 'website' && (
                            <>
                              <div style={{ fontWeight: "bold" }}>Source Type: Website</div>
                              <div>URL: {source.website_url}</div>
                            </>
                          )}
                          {source.source === 'youtube' && (
                            <>
                              <div style={{ fontWeight: "bold" }}>Source Type: YouTube</div>
                              <div>URL: {source.url}</div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {lead_generation_enabled && messages.length === 1 && !formSubmitted && hasLeadFields && (
                    <div
                      style={{
                        marginBottom: "16px",
                        maxWidth: isFullScreen ? "40%" : "80%",
                        backgroundColor: bot_color || "#e5e7eb",
                        color: chat_text_color || "#111827",
                        borderRadius: border_radius || "20px",
                        padding: "12px",
                        fontFamily: chat_font_family || font_style,
                        fontSize: font_size ? `${font_size}px` : "14px",
                        marginLeft: "0px",
                        marginRight: "auto",
                        boxSizing: "border-box", // ✅ ensures padding doesn't overflow
                      }}

                    >
                      <div style={{ marginBottom: "8px", fontWeight: 500 }}>
                        Please enter your details to continue:
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                         {lead_form_fields?.includes("name") && (
                        <div style={{ position: "relative", width: "100%" }}>
                      <input
                        type="text"
                        placeholder="Name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: border_radius ||  "8px",
                          border: `1px solid ${border_color || "#ccc"}`,
                          fontSize: font_size ? `${font_size}px` : "14px",
                          boxSizing: "border-box",
                        }}
                      />
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
                          </span>
                        </div>
                        )}
                         {/* Phone (required) */}
                               {lead_form_fields?.includes("phone") && (
                              <div style={{ position: "relative", width: "100%" }}>
                        <input
                          type="tel"
                          placeholder="Your Phone"
                          value={userPhone}
                          onChange={(e) => {
                              const value = e.target.value;
                              const filteredValue = value.replace(/[^0-9+-]/g, "");
                              setUserPhone(filteredValue)}}
                          maxLength={15}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: border_radius ||  "8px",
                            border: `1px solid ${border_color || "#ccc"}`,
                            fontSize: font_size ? `${font_size}px` : "14px",
                            backgroundColor: "#fff",
                            boxSizing: "border-box",
                          }}
                        />
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
                          </span>
                        </div>
)}
                        {/* Email (optional) */}

                         {lead_form_fields?.includes("email") && (
                          <div style={{ position: "relative", width: "100%" }}>
                          <input
                          type="email"
                          placeholder="Email"
                          value={userEmail}
                          onChange={(e) => setUserEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: border_radius ||  "8px",
                            border: `1px solid ${border_color || "#ccc"}`,
                            fontSize: font_size ? `${font_size}px` : "14px",
                            boxSizing: "border-box",
                          }}
                        />
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
                          </span>
                        </div>
)}
                          {/* Address (optional) */}
                           {lead_form_fields?.includes("address") && (
                            <div style={{ position: "relative", width: "100%" }}>
                          <input
                              type="text"
                              placeholder="Address"
                              value={userAddress}
                              onChange={(e) => setUserAddress(e.target.value)}
                              style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: border_radius ||  "8px",
                                border: `1px solid ${border_color || "#ccc"}`,
                                fontSize: font_size ? `${font_size}px` : "14px",
                                boxSizing: "border-box",
                              }}
                            />
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
                          </span>
                        </div>

)}
                        {emailError && (
                          <div style={{ color: "red", fontSize: "13px" }}>{emailError}</div>
                        )}

                        <button
                          onClick={async () => {
                            // const requiredFields = lead_form_fields || [];
                            let errorMessage = "";

  if (lead_form_fields?.includes("name") && !userName.trim()) {
    errorMessage = "Name is required.";
  }

  if (!errorMessage && lead_form_fields?.includes("phone") && !userPhone.trim()) {
    errorMessage = "Phone is required.";
  }

  if (!errorMessage && lead_form_fields?.includes("email")) {
    if (!userEmail.trim()) {
      errorMessage = "Email is required.";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail.trim())) {
        errorMessage = "Please enter a valid email address.";
      }
    }
  }

  if (!errorMessage && lead_form_fields?.includes("address") && !userAddress.trim()) {
    errorMessage = "Address is required.";
  }

  if (errorMessage) {
    setEmailError(errorMessage); // or any other error handling logic
    return;
  }
                            try {
                            await axios.post(`${baseDomain}/widget/lead`, {
                              name: userName,
                              phone: userPhone,
                              email: userEmail,
                              address: userAddress,
                            }, {
                              headers: {
                                Authorization: `Bot ${botId}`,
                              },
                            });
                          } catch (err) {
                            console.error("Failed to save lead info", err);
                          }
                            setFormSubmitted(true);
                            setEmailError("");

                          }}
                          style={{
                            padding: "10px",
                            backgroundColor: button_color || "#3b82f6",
                            color: button_text_color || "#fff",
                            border: "none",
                            borderRadius: "8px",
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
            {/* <div ref={chatEndRef} /> */}
            {/* Bot is Typing */}
            {isBotTyping && (
              <div
                className="mr-auto my-2"
                style={{
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {currentBotMessage === "" ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 7px",
                      borderRadius: "16px",
                      maxWidth: "200px",
                      minHeight: "32px",
                      width: "fit-content",
                      backgroundColor: bot_color || "#e9ecef",
                      fontFamily: chat_font_family || font_style,
                      fontSize: font_size ? `${font_size}px` : "14px",
                    }}
                  >
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        backgroundColor: "#555",
                        borderRadius: "50%",
                        margin: "0 2px",
                        animation: "bounce 1.4s infinite ease-in-out both",
                        animationDelay: "0s",
                      }}
                    >
                      &nbsp;
                    </span>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        backgroundColor: "#555",
                        borderRadius: "50%",
                        margin: "0 2px",
                        animation: "bounce 1.4s infinite ease-in-out both",
                        animationDelay: "0.2s",
                      }}
                    >
                      &nbsp;
                    </span>
                    <span
                      style={{
                        width: "6px",
                        height: "6px",
                        backgroundColor: "#555",
                        borderRadius: "50%",
                        margin: "0 2px",
                        animation: "bounce 1.4s infinite ease-in-out both",
                        animationDelay: "0.4s",
                      }}
                    >
                      &nbsp;
                    </span>
                  </div>
                ) : (
                  <div
                    className="mr-auto rounded-lg max-w-[80%] p-3"
                    style={{
                      backgroundColor: "transparent",
                      fontFamily: chat_font_family || font_style,
                      fontSize: font_size ? `${font_size}px` : "14px",
                    }}
                  >
                    {currentBotMessage}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        marginLeft: "4px",
                      }}
                    >
                      <span
                        style={{
                          height: "6px",
                          width: "6px",
                          backgroundColor: "#555",
                          borderRadius: "50%",
                          margin: "0 2px",
                          animation: "bounce 1.4s infinite ease-in-out both",
                          animationDelay: "0s",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "6px",
                          width: "6px",
                          backgroundColor: "#555",
                          borderRadius: "50%",
                          margin: "0 2px",
                          animation: "bounce 1.4s infinite ease-in-out both",
                          animationDelay: "0.2s",
                        }}
                      ></span>
                      <span
                        style={{
                          height: "6px",
                          width: "6px",
                          backgroundColor: "#555",
                          borderRadius: "50%",
                          margin: "0 2px",
                          animation: "bounce 1.4s infinite ease-in-out both",
                          animationDelay: "0.4s",
                        }}
                      ></span>
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* {isBotTyping && (
          <div
            style={{
              margin: "6px 0",
              textAlign: "left",
            }}
          >
            <span
              className="typing-indicator"
              style={{
                backgroundColor: bot_color || "#e9ecef",
                fontFamily: font_style || "Arial, sans-serif",
                fontSize: font_size ? `${font_size}px` : "14px",
              }}
            >
              {currentBotMessage }
              
            </span>
          </div>
        )} */}
            {/* Show current bot message as the bot types */}
            {/* {currentBotMessage && !isBotTyping && (
          <div
            style={{
              margin: "6px 0",
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: "16px",
                backgroundColor: bot_color || "#e9ecef",
                color: "#000",
                maxWidth: "80%",
                fontFamily: font_style || "Arial, sans-serif",
                fontSize: font_size ? `${font_size}px` : "14px",
              }}
            >
              {currentBotMessage}
            </span>
          </div>
        )} */}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {!hasWhiteLabeling && (
          <div
            style={{
              textAlign: "right",
              color: getContrastColor(window_bg_color),
              fontSize: "12px",
              padding: "12px 10px",
              fontStyle: "italic",
            }}
          >
            Powered by Evolra AI
          </div>
        )}

        {usageError && (
          <div
            style={{
              backgroundColor: "#ffe5e5",
              color: "#b30000",
              padding: "10px",
              marginBottom: "10px",
              border: "1px solid #ffcccc",
              borderRadius: "4px",
              fontSize: "0.9rem",
              textAlign: "center",
            }}
          >
            {usageError}
          </div>
        )}

        {/* New div */}
                    <div style={{ backgroundColor: "rgb(255, 255, 255)" }}>
                        <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          backgroundColor: "#E8EBF0",
                          borderRadius: border_radius || "20px",
                          padding: "0.25rem 0.5rem",
                          margin:"1rem",
                          // opacity: lead_generation_enabled && !formSubmitted ? 0.6 : 1,
                        }}
                      >
                          <input
                            type="text"
                            disabled={lead_generation_enabled && !formSubmitted &&  hasLeadFields}
                            placeholder="Type a message..."
                            style={{
                              flexGrow: 1,
                              padding: "0.5rem 0.75rem",
                              backgroundColor: "#E8EBF0",
                              border: "none",
                              outline: "none",
                              fontSize: font_size,
                              borderRadius: border_radius || "20px",
                              cursor:
                                lead_generation_enabled && !formSubmitted &&  hasLeadFields ? "not-allowed" : "text",
                            }}
                            value={inputMessage}
                            onChange={(e) => {
                                      const value = e.target.value;
                                      setInputMessage(value);
                                    }}
                            onKeyDown={(e) => {
                                      if (e.key === "Enter" && inputMessage.trim() &&
                                      !isSendDisabled &&
                                        !isBotTyping &&  (!lead_generation_enabled || formSubmitted || !hasLeadFields )) {
                                        sendMessage();
                                      }
                                    }}
                                  />

                            <button
                              onClick={sendMessage}
                              disabled={
                                        !inputMessage.trim() ||
                                        isSendDisabled ||
                                        isBotTyping ||
                                        inputMessage.length > MAX_USER_MESSAGE_LENGTH
                                        ||
                                        (lead_generation_enabled && !formSubmitted && hasLeadFields)
                                      }
                              style={{
                                marginLeft: "0.5rem",
                                border: "none",
                                backgroundColor: "transparent",
                                cursor:
                                  !inputMessage.trim() ||
                                  isSendDisabled ||
                                  isBotTyping ||
                                  (lead_generation_enabled && !formSubmitted && hasLeadFields)
                                    ? "not-allowed"
                                    : "pointer",
                                opacity:
                                  !inputMessage.trim() ||
                                  isSendDisabled ||
                                  isBotTyping ||
                                  (lead_generation_enabled && !formSubmitted && hasLeadFields)
                                    ? 0.75
                                    : 1,
                              }}
                            >
                            <img
                              src={`${widgetdomain}/images/dummy/send-icons.png`}
                              alt="Send"
                              style={{ width: "20px", height: "20px", objectFit: "contain" }}
                            />
                          </button>
                        </div>
                        </div>

        {/* Show warning if max length reached */}
        {inputMessage.length > MAX_USER_MESSAGE_LENGTH && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#ef4444",
              marginTop: "0.25rem",
            }}
          >
            You have reached the maximum allowed characters of 1000.
          </div>
        )}
      </div>
    );
  }
);

ChatbotWidget.displayName = "ChatbotWidget";

export default ChatbotWidget;