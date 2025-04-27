import React from "react";
import ReactDOM from "react-dom/client";
import ChatIcon from "./ChatIcon";
import { jwtDecode } from "jwt-decode";

interface BotTokenPayload {
  bot_id: number;
  exp?: number; // optional, in case you later include expiry again
}

const validPositions = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
type PositionType = (typeof validPositions)[number];

// Get the script tag that loaded this bundle
const currentScript = document.currentScript as HTMLScriptElement;
// Define allowed positions

// Get botId and optional avatar image from data attributes
//const botId = parseInt(currentScript?.getAttribute("data-bot-id") || "1", 10);

// Get the token from data attributes
const token = currentScript?.getAttribute("data-token") || "";
const decoded: BotTokenPayload = jwtDecode<BotTokenPayload>(token);
const botId = decoded.bot_id;

// Decode the token to get the bot_id
const getCleanAttribute = (
  value: string | null | undefined
): string | undefined => {
  return value && value !== "null" && value.trim() !== "" ? value : undefined;
};

const avatarUrl =
  getCleanAttribute(currentScript?.getAttribute("data-avatar-url")) ||
  "https://cdn-icons-png.flaticon.com/512/4712/4712027.png";
const rawPosition =
  currentScript?.getAttribute("data-position") || "bottom-right";
const position: PositionType = validPositions.includes(
  rawPosition as PositionType
)
  ? (rawPosition as PositionType)
  : "bottom-right";

const welcomeMessage =
  currentScript?.getAttribute("data-welcome-message") || "";
const basedomain = currentScript?.getAttribute("basedomain") || "";

// ✅ Create and append the container dynamically
const container = document.createElement("div");
container.id = "chatbot-widget-container";
document.body.appendChild(container);

// Render the ChatIcon component
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <ChatIcon
      botId={botId}
      avatarUrl={avatarUrl}
      position={position}
      welcomeMessage={welcomeMessage}
      basedomain={basedomain}
    />
  </React.StrictMode>
);
