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
}

interface ChatbotWidgetProps {
  botId: number;
  closeWidget: () => void; // Function to close the widget
  baseDomain: string;
}

export interface ChatbotWidgetHandle {
  endSession: () => Promise<void>;
}

const ChatbotWidget = forwardRef<ChatbotWidgetHandle, ChatbotWidgetProps>(
  ({ botId, closeWidget, baseDomain }, ref) => {
    const [botSettings, setBotSettings] = useState<BotSettings | null>(null);
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
    const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
    //const [showWelcomeBubble] = useState(true);
    const [usageError, setUsageError] = useState("");
    const [isSendDisabled, setIsSendDisabled] = useState(false);

    useEffect(() => {
      const fetchBotSettings = async () => {
        console.log("baseDomain", baseDomain);
        try {
          const response = await axios.get<BotSettings>(
            `${baseDomain}/botsettings/bot/${botId}`
          );
          console.log("response", response);
          setBotSettings(response.data);
        } catch (error) {
          console.error("Error fetching bot settings:", error);
        }
      };

      fetchBotSettings();
    }, [botId]);
    useEffect(() => {
      if (botSettings?.welcome_message && !welcomeMessage) {
        let displayed = "";

        let index = 0;
        const typeInterval = setInterval(() => {
          if (index < (botSettings?.welcome_message?.length ?? 0)) {
            displayed += botSettings.welcome_message?.[index] ?? "";
            setWelcomeMessage(displayed);
            index++;
          } else {
            clearInterval(typeInterval);
          }
        }, 30); // Typing speed
      }
    }, [botSettings, welcomeMessage]);

    // Attach unload listener and idle timer
    useEffect(() => {
      const handleBeforeUnload = () => {
        endSession();
      };

      window.addEventListener("beforeunload", handleBeforeUnload);
      resetIdleTimer(); // start on mount

      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
        if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      };
    }, []);

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

    const sendMessage = async () => {
      const trimmedMessage = inputMessage.trim();
      if (!trimmedMessage || !botSettings?.user_id) return;
      const quotaResponse = await axios.get(
        `${baseDomain}/api/usage/messages/check`,
        {
          params: { user_id: botSettings.user_id },
        }
      );
      if (!quotaResponse.data.canSendMessage) {
        setUsageError(
          "We are facing technical issue. Kindly reach out to website admin for assistance."
        );
        setIsSendDisabled(true);
        return;
      }

      // Clear error if they are allowed again (if this check is ever reused)
      setUsageError("");
      setIsSendDisabled(false);

      setMessages((prev) => [
        ...prev,
        { sender: "user", message: trimmedMessage },
      ]);
      setInputMessage("");
      resetIdleTimer();

      try {
        if (!sessionIdRef.current) {
          const startResponse = await axios.post(
            `${baseDomain}/chat/start_chat`,
            {
              bot_id: botId,
              user_id: botSettings.user_id,
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

        const response = await axios.post(`${baseDomain}/chat/send_message`, {
          interaction_id: sessionIdRef.current,
          sender: "user",
          message_text: trimmedMessage,
        });
        console.log("responsesend_message ", response);

        //clearInterval(dotInterval); // Stop the dots animation
        setCurrentBotMessage(""); // Clear the dots

        const botReply = response.data.message;
        const botMessageId = response.data.message_id; // make sure backend sends this

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
          `${baseDomain}/botsettings/interactions/reaction`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              interaction_id: interaction_id,
              session_id: `${messageId}-${index}`,
              bot_id: botId,
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
            `${baseDomain}/chat/interactions/${sessionIdRef.current}/end`
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
      appearance,
      input_bg_color,
      max_words_per_message,
    } = botSettings;

    const [vertical, horizontal] = (position || "bottom-right").split("-");

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
      fontFamily: font_style || "Arial, sans-serif",
      fontSize: font_size ? `${font_size}px` : "14px",
      position: "fixed",
      zIndex: 2147483647,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",

      ...(appearance === "Full Screen"
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
            width: "400px",
            maxWidth: "100dvw",
            height: "720px",
            maxHeight: "84dvh",
            backgroundColor: window_bg_color || "#F9FAFB",
            border: `1px solid ${bot_color || "rgb(229, 231, 235)"}`,
            borderRadius: "12px",
            boxShadow:
              "rgba(0, 0, 0, 0.2) 5px 5px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px",
          }),
    };

    const headerStyle: React.CSSProperties = {
      backgroundColor: bot_color || "#007bff",
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

    const chatBodyStyle: React.CSSProperties = {
      flex: 1,
      padding: "10px",
      overflowY: "auto",
      backgroundColor: window_bg_color || "#f9f9f9",
    };

    const inputStyle: React.CSSProperties = {
      display: "flex",
      borderTop: "1px solid #ddd",
      padding: "8px",
      background: input_bg_color || "#fff",
    };

    // const inputBoxStyle: React.CSSProperties = {
    //   flex: 1,
    //   padding: "8px",
    //   border: "1px solid #ccc",
    //   borderRadius: "4px",
    //   fontSize: "14px",
    // };

    return (
      <div style={widgetStyle}>
        {/* {botSettings?.welcome_message && showWelcomeBubble && (
        <div
          style={{
            position: "absolute",
            bottom: "80px",
            right: "20px",
            backgroundColor: "#fff",
            borderRadius: "16px",
            padding: "10px 14px",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
            maxWidth: "250px",
            fontSize: "14px",
            lineHeight: "1.4",
            zIndex: 999,
            animation: "fadeIn 0.5s ease-in-out",
          }}
        >
          {botSettings.welcome_message}
        </div>
      )} */}
        <div
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "16px",
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
        <div style={headerStyle}>
          {bot_icon && <img src={bot_icon} alt="Bot Icon" style={iconStyle} />}
          <strong>{bot_name}</strong>
        </div>

        <div style={chatBodyStyle}>
          {welcomeMessage && (
            <div
              style={{
                backgroundColor: bot_color || "#f0f0f0",
                padding: "10px 14px",
                borderRadius: "16px",
                maxWidth: "80%",
                margin: "10px auto",
                color: "#333",
                fontStyle: "italic",
                fontSize: "15px",
                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                textAlign: "center",
                whiteSpace: "pre-wrap",
              }}
            >
              {welcomeMessage}
            </div>
          )}
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                justifyContent:
                  msg.sender === "user" ? "flex-end" : "flex-start",
                marginBottom: "8px",
                margin: "6px 0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.sender === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    maxWidth: "80%",
                    backgroundColor:
                      msg.sender === "user"
                        ? user_color || "#3b82f6"
                        : bot_color || "#e5e7eb",
                    color: msg.sender === "user" ? "#fff" : "#111827",
                    fontSize: font_size ? `${font_size}px` : "14px",
                    fontFamily: font_style || "Arial, sans-serif",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.message}
                </div>
                {/* 👍👎 Reactions - only show for bot messages */}
                {msg.sender === "bot" && (
                  <div
                    style={{
                      marginTop: "4px",
                      display: "flex",
                      padding: "0pxss",
                    }}
                  >
                    <button
                      onClick={() => handleReaction("like", index)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: msg.reaction === "like" ? "#22c55e" : "#6b7280", // red if selected, gray otherwise
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
                          msg.reaction === "dislike" ? "#ef4444" : "#6b7280", // red if selected, gray otherwise
                      }}
                    >
                      <ThumbsDown size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

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
                    fontFamily: font_style || "Arial, sans-serif",
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
                    fontFamily: font_style || "Arial, sans-serif",
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
        {/* "Powered by Elvora" footer */}
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
              padding: "0.5rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.5rem",
              backgroundColor: input_bg_color || "#ffffff",
              color: "#111827",
              outline: "none",
              fontSize: "1rem",
            }}
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => {
              const value = e.target.value;
              if (
                !max_words_per_message ||
                value.length <= max_words_per_message
              ) {
                setInputMessage(value);
              }
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
              backgroundColor: "#3b82f6", // tailwind blue-500
              color: "white",
              borderRadius: "0.5rem",
              cursor: "pointer",
              border: "none",
              transition: "background-color 0.2s ease",
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
            disabled={!inputMessage.trim() || isSendDisabled}
          >
            Send
          </button>
        </div>
        {/* Show warning if max length reached */}
        {inputMessage.length === max_words_per_message && (
          <div className="text-xs text-red-500 mt-1">
            You have reached the maximum allowed characters.
          </div>
        )}
      </div>
    );
  }
);

ChatbotWidget.displayName = "ChatbotWidget";

export default ChatbotWidget;
