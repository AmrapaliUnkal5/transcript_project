import React from "react";
import ReactDOM from "react-dom/client";
import ChatIcon from "./ChatIcon";

const validPositions = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
type PositionType = (typeof validPositions)[number];


const currentScript = document.currentScript as HTMLScriptElement;
const token = currentScript?.getAttribute("data-token") || "";
const basedomain = import.meta.env.VITE_SERVER_DOMAIN || "https://aiassist.bytepx.com/api";
const appearance = currentScript?.getAttribute("data-appearance") || "";

// 👇 Fetch widget settings (avatar, position, welcome message)
fetch(`${basedomain}/widget/initial/bot`, {
  headers: {
    Authorization: `Bot ${token}`,
  },
})
  .then((res) => {
    if (!res.ok) throw new Error("Failed to fetch widget settings");
    return res.json();
  })
  .then((data) => {
    const { avatarUrl, position, welcomeMessage } = data;

    const container = document.createElement("div");
    container.id = "chatbot-widget-container";
    document.body.appendChild(container);

    const validatedPosition: PositionType = (validPositions.includes(position) ? position : "bottom-right") as PositionType;
    console.log("welcomeMessage",welcomeMessage)

    const root = ReactDOM.createRoot(container);
    root.render(
      <React.StrictMode>
        <ChatIcon
          botId={token}
          avatarUrl={avatarUrl}
          position={validatedPosition}
          welcomeMessage={welcomeMessage}
          basedomain={basedomain}
          appearance={appearance}
        />
      </React.StrictMode>
    );
  })
  .catch((error) => {
    console.error("Error initializing chatbot widget:", error);
  });
