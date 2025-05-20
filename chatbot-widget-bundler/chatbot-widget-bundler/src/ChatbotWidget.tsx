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
  ({ botId, closeWidget, baseDomain, appearance: widgetAppearance  }, ref) => {
    
    const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
    const effectiveAppearance = widgetAppearance || botSettings?.appearance;
    const [messages, setMessages] = useState<
      {
        sender: "user" | "bot";
        message: string;
        message_id?: number;
        reaction?: "like" | "dislike";
      }[]
    >([]);
    const [inputMessage, setInputMessage] = useState("");
    const sessionIdRef = useRef<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    //const [interactionId, setInteractionId] = useState<number | null>(null);
    const [isBotTyping, setIsBotTyping] = useState(false); // New state for typing animation
    const [currentBotMessage, setCurrentBotMessage] = useState<string>("");
    const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [welcomeMessageIndex, setWelcomeMessageIndex] = useState<
      number | null
    >(null);
    //const [showWelcomeBubble] = useState(true);
    const [usageError, setUsageError] = useState("");
    const [isSendDisabled, setIsSendDisabled] = useState(false);
    const [hasWelcomeBeenShown, setHasWelcomeBeenShown] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement | null>(null);
    const [hasWhiteLabeling, setHasWhiteLabeling] = useState(false);

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
            Authorization: `Bot ${botId}`, // Securely send botId
          },
        }
      );
          console.log("White-Labeling response", response);
          setHasWhiteLabeling(response.data.hasWhiteLabeling);
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
        setWelcomeMessageIndex(0);
        setHasWelcomeBeenShown(true);
      }
    }, [botSettings, hasWelcomeBeenShown, messages.length]);

    // useEffect(() => {
    //   if (
    //     botSettings?.welcome_message &&
    //     !welcomeMessage &&
    //     !hasWelcomeBeenShown
    //   ) {
    //     let displayed = "";

    //     let index = 0;
    //     const typeInterval = setInterval(() => {
    //       if (index < (botSettings?.welcome_message?.length ?? 0)) {
    //         displayed += botSettings.welcome_message?.[index] ?? "";
    //         setWelcomeMessage(displayed);
    //         index++;
    //       } else {
    //         clearInterval(typeInterval);
    //         setHasWelcomeBeenShown(true);
    //       }
    //     }, 30); // Typing speed
    //   }
    // }, [botSettings, welcomeMessage, hasWelcomeBeenShown]);

    // Attach unload listener and idle timer
    useEffect(() => {
  const sendEndRequest = () => {
    if (!sessionIdRef.current) return;

    fetch(
      `${baseDomain}/widget/interactions/${sessionIdRef.current}/end`,
      {
        method: "PUT",
        keepalive: true,
      }
    );
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

    const sendMessage = async () => {
      const trimmedMessage = inputMessage.trim();
      if (!trimmedMessage) return;
      console.log("I am here sendMessage")

      const quotaResponse = await axios.get(
      `${baseDomain}/api/usage/messages/check`,
      {
        headers: {
          Authorization: `Bot ${botId}`, // ✅ Securely send botId in header
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

      setMessages((prev) => {
        const updatedMessages =
          welcomeMessageIndex !== null
            ? prev.filter((_, idx) => idx !== welcomeMessageIndex)
            : prev;
        setWelcomeMessageIndex(null);
        return [
          ...updatedMessages,
          { sender: "user", message: trimmedMessage },
        ];
      });
      setInputMessage("");
      resetIdleTimer();
      console.log("Current session ID:", sessionIdRef.current); // Debug log

      try {
          if (!sessionIdRef.current) {
          const startResponse = await axios.post(
            `${baseDomain}/widget/start_chat`,
            {session_id: userIdRef.current }, // Empty body since backend doesn't require anything in the body
            {
              headers: {
                Authorization: `Bot ${botId}`, // Bot ID passed in header
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

        //clearInterval(dotInterval); // Stop the dots animation
        setCurrentBotMessage(""); // Clear the dots

        const botReply = response.data.message;
        const botMessageId = response.data.message_id; // make sure backend sends this
        // ✅ Handle backend error gracefully
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
              { sender: "bot", message: botReply, message_id: botMessageId },
            ]);
            setCurrentBotMessage("");
            setIsBotTyping(false);
          }
        }, 30); // speed of typing (adjust as needed)
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
              Authorization: `Bot ${botId}`, // Securely send botId
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
          sessionIdRef.current = null; // ✅ Reset here
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
      }, 60 * 60 * 1000); // 1 hour
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
      
      input_bg_color,
      header_bg_color,
      header_text_color,
      user_text_color,
      chat_text_color,
      button_color,
      button_text_color,
      
      chat_font_family,
      border_radius,
      border_color,
    } = botSettings;

    const [vertical, horizontal] = (position || "bottom-right").split("-");
    const MAX_USER_MESSAGE_LENGTH = 1000;

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

      ...(effectiveAppearance === "Full Screen"
        ? {
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: window_bg_color || "#F9FAFB",
            border: "none",
            borderRadius: "0px",
            boxShadow: "none",
          }
        : {
            ...(vertical === "top" ? { top: "110px" } : { bottom: "90px" }),
            ...(horizontal === "left" ? { left: "20px" } : { right: "20px" }),
            width: "380px",
            maxWidth: "100dvw",
            height: "600px",
            maxHeight: "84dvh",
            backgroundColor: window_bg_color || "#F9FAFB",
            border: `1px solid ${border_color || "#E5E7EB"}`,
            borderRadius: "12px",
            boxShadow:
              "rgba(0, 0, 0, 0.2) 5px 5px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px",
          }),
    };

    const headerStyle: React.CSSProperties = {
      backgroundColor: header_bg_color || "#3B82F6",
      color: header_text_color || "#fff",
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

    const chatBodyStyle: React.CSSProperties = {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: "10px",
      overflowY: "auto",
      backgroundColor: window_bg_color || "#f9f9f9",
      height: "calc(100% - 120px)",
    };

    const inputStyle: React.CSSProperties = {
      display: "flex",

      padding: "16px", // equivalent to p-4
      borderTop: `1px solid ${border_color || "#E5E7EB"}`,
      alignItems: "center",
      backgroundColor: "#374151",
      gap: "0.5rem", // similar to spacing between input and button in Tailwind
    };

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
        {effectiveAppearance !== "Full Screen" && (
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: chat_font_family ? `${font_size}px` : "14px",
            color: "#fff",
            cursor: "pointer",
            zIndex: 1,
          }}
          onClick={() => {
            endSession();
            closeWidget(); // Close the widget when X is pressed
          }}
        >
          ✕
        </div>
       )}
        <div style={headerStyle}>
          {bot_icon && <img src={bot_icon} alt="Bot Icon" style={iconStyle} />}
          <strong>{bot_name}</strong>
        </div>
 
        <div style={chatBodyStyle}>
          <div style={{ marginTop: "auto" }}>
            {messages.map((msg, index) => (
              <div key={index} style={{ marginBottom: "16px" }}>
                {/* Message Bubble */}
                <div
                  style={{
                    padding: "12px",
                    borderRadius:
                      border_radius === "rounded-full"
                        ? "20px"
                        : border_radius || "12px",
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
                  <div style={{fontSize: "11px",marginTop: "4px",textAlign: "right",color:
      msg.sender === "user"
        ? user_text_color || "#ffffff"
        : chat_text_color || "#111827",}}>
                    {new Date().toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                {/* Reaction Buttons - Only for Bot */}
                {msg.sender === "bot" && index !== welcomeMessageIndex && (
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
                  </div>
                )}
              </div>
            ))}
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
        {/* "Powered by Elvora" footer */}
        {!hasWhiteLabeling && (
          <div
            style={{
              textAlign: "right",
              color: "#6b7280", // Tailwind gray-500
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

        <div style={inputStyle}>
          <input
            type="text"
            style={{
              flexGrow: 1,
              padding: "0.5rem 0.75rem", // similar to Tailwind `p-2`
              border: `1px solid ${border_color || "#d1d5db"}`,
              borderRadius:
                border_radius === "rounded-full"
                  ? "20px"
                  : border_radius || "8px",
              backgroundColor: input_bg_color || "#ffffff",
              color: chat_text_color || "#111827",
              outline: "none",
              fontSize: font_size,
              transition: "border-color 0.2s ease",
            }}
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => {
              const value = e.target.value;
              setInputMessage(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && inputMessage.trim()) {
                sendMessage();
              }
            }}
          />

          <button
            style={{
              marginLeft: "0.5rem",
              padding: "0.5rem 1rem",
              lineHeight: "1.5rem",
              backgroundColor: button_color || "#3b82f6", // tailwind blue-500
              color: button_text_color || "#ffffff",
              borderRadius:
                border_radius === "rounded-full"
                  ? "20px"
                  : border_radius || "8px",
              cursor:
                !inputMessage.trim() || isSendDisabled
                  ? "not-allowed"
                  : "pointer", // disabled:cursor-not-allowed
              border: "none",
              transition: "opacity 0.2s ease",
              opacity: !inputMessage.trim() || isSendDisabled ? 0.7 : 1,
              fontWeight: "500",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#2563eb"; // blue-600
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "#3b82f6";
            }}
            onClick={sendMessage}
            disabled={
              !inputMessage.trim() ||
              isSendDisabled ||
              inputMessage.length > MAX_USER_MESSAGE_LENGTH
            }
            
          >
            Send
          </button>
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
