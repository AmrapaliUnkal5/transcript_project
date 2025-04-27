import React, { useState, useRef } from "react";
import ChatbotWidget from "./ChatbotWidget";
//import { MinusCircle } from "lucide-react";
import { ChevronDown } from "lucide-react";

// TypeScript-safe prop types
interface ChatIconProps {
  botId: number;
  avatarUrl?: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  welcomeMessage?: string; // optional
  basedomain: string;
}

const ChatIcon: React.FC<ChatIconProps> = ({
  botId,
  avatarUrl,
  position,
  welcomeMessage,
  basedomain,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const chatbotRef = useRef<{ endSession: () => Promise<void> }>(null);
  const [showWelcome] = useState(true);
  const [hover, setHover] = useState(false);
  const baseDomain = basedomain;

  const getPositionStyles = (
    position: ChatIconProps["position"]
  ): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
    };

    switch (position) {
      case "top-left":
        return { ...base, top: "30px", left: "30px" };
      case "top-right":
        return { ...base, top: "30px", right: "30px" };
      case "bottom-left":
        return { ...base, bottom: "30px", left: "30px" };
      case "bottom-right":
      default:
        return { ...base, bottom: "30px", right: "30px" };
    }
  };

  //   useEffect(() => {
  //     if (!isOpen) {
  //       const timer = setTimeout(() => setShowWelcome(false), 4000); // 4 seconds
  //       return () => clearTimeout(timer);
  //     }
  //   }, [isOpen]);

  const toggleWidget = async () => {
    if (isOpen && chatbotRef.current) {
      await chatbotRef.current.endSession(); // Call endSession via ref
    }
    setIsOpen(!isOpen);
  };

  // Close the widget (reset to original state)
  const closeWidget = () => {
    setIsOpen(false); // Close the chatbot widget
  };

  const iconStyles: React.CSSProperties = {
    width: "60px",
    height: "60px",
    zIndex: 9999,
    cursor: "pointer",
    borderRadius: "50%",
    boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
    backgroundColor: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.3s ease",
    ...getPositionStyles(position),
  };

  //   const minimizeIconStyles: React.CSSProperties = {
  //     fontSize: "48px",
  //     color: "#fff",
  //     fontWeight: "bold",
  //     marginTop: "-4px",
  //   };

  const minimizeIconStyles: React.CSSProperties = {
    width: "40px",
    height: "40px",
    backgroundColor: "#003B80", // deep blue like the image
    color: "white", // icon color
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 10px rgba(0, 0, 0, 0.15)",
    cursor: "pointer",
    transition: "all 0.2s ease-in-out",
    position: "absolute",
    top: "10px",
    right: "10px",
  };

  const welcomeTooltipStyles: React.CSSProperties = {
    backgroundColor: "white",
    color: "black",
    boxShadow:
      "rgba(111, 111, 111, 0.2) 0px 10px 30px 0px, rgba(96, 96, 96, 0.2) 0px 0px 0px 1px",
    borderRadius: "10px",
    padding: "20px",
    margin: "8px",
    fontSize: "14px",
    position: "fixed",
    maxWidth: "400px",
    zIndex: 2147483647,
    fontFamily:
      '"Segoe UI", "Segoe UI Emoji", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
    opacity: showWelcome ? 1 : 0,
    transform: showWelcome ? "scale(1)" : "scale(0.95)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
    cursor: "pointer",
    ...(() => {
      switch (position) {
        case "bottom-right":
          return { bottom: "100px", right: "20px" };
        case "bottom-left":
          return { bottom: "100px", left: "20px" };
        case "top-right":
          return { top: "100px", right: "20px" };
        case "top-left":
          return { top: "100px", left: "20px" };
        default:
          return {};
      }
    })(),
  };

  return (
    <>
      {/* Welcome Tooltip */}
      {!isOpen && showWelcome && welcomeMessage && (
        <div style={welcomeTooltipStyles}>{welcomeMessage}</div>
      )}

      <div style={iconStyles} onClick={toggleWidget}>
        {isOpen ? (
          <div
            style={{
              ...minimizeIconStyles,
              transform: hover ? "scale(1.1)" : "scale(1)",
            }}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <ChevronDown size={20} />
          </div>
        ) : (
          <img
            src={avatarUrl}
            alt="Chatbot Icon"
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      {isOpen && (
        <div
          id="chatbot-root"
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: "fixed",
            zIndex: 9998,
            ...getPositionStyles(position),
          }}
        >
          <React.StrictMode>
            <ChatbotWidget
              ref={chatbotRef}
              botId={botId}
              closeWidget={closeWidget}
              baseDomain={baseDomain}
            />
          </React.StrictMode>
        </div>
      )}
    </>
  );
};

export default ChatIcon;
