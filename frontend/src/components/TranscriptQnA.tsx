import React, { useCallback, useMemo, useRef, useState } from "react";
import { Bot, X, Send } from "lucide-react";
import { transcriptApi } from "../services/api";

type Msg = { role: "user" | "assistant"; content: string };

interface TranscriptQnAProps {
  recordId: number | null;
  disabledReason?: string;
}

const TranscriptQnA: React.FC<TranscriptQnAProps> = ({ recordId, disabledReason }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canChat = useMemo(() => !!recordId, [recordId]);

  const onSend = useCallback(async () => {
    const q = input.trim();
    if (!q || !recordId) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await transcriptApi.chat(recordId, q, history);
      const ans = (res?.answer || "").trim() || "Not specified";
      setMessages((m) => [...m, { role: "assistant", content: ans }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "Not specified" }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, recordId, messages]);

  return (
    <>
      <button
        type="button"
        className={`fixed right-4 bottom-8 z-40 rounded-full p-3 shadow-lg ${open ? "bg-[#39489D] text-white" : "bg-white text-[#39489D]"} border border-gray-200`}
        onClick={() => setOpen((v) => !v)}
        title={canChat ? "Patient QnA" : (disabledReason || "Open a patient record to enable QnA")}
        disabled={!canChat}
      >
        <Bot className="w-6 h-6" />
      </button>

      {open && (
        <div className="fixed right-4 bottom-24 z-40 w-96 max-w-[90vw] rounded-2xl shadow-2xl border border-gray-200 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-[#39489D] text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <span className="text-sm font-medium">Patient QnA</span>
            </div>
            <button className="p-1 rounded hover:bg-white/10" onClick={() => setOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="h-72 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 ? (
              <div className="text-sm text-gray-500 px-2 py-2">
              </div>
            ) : (
              messages.map((m, idx) => {
                const isUser = m.role === "user";
                return (
                  <div key={idx} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                    <div
                      className={`max-w-[80%] text-sm px-3 py-2 border rounded-2xl shadow-sm break-words ${
                        isUser
                          ? "bg-blue-50 text-blue-600 border-blue-200 rounded-tl-md rounded-br-2xl"
                          : "bg-gradient-to-br from-green-50 to-teal-50 text-gray-900 border-green-200 rounded-tr-md rounded-bl-2xl"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })
            )}
            {loading && (
              <div className="text-sm text-gray-500 px-2 py-1">Thinking…</div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 border-t border-gray-200">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSend();
              }}
              placeholder={canChat ? "Type your question…" : (disabledReason || "Open a patient record to enable QnA")}
              disabled={!canChat || loading}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#39489D] disabled:opacity-60"
            />
            <button
              className="px-3 py-2 rounded-lg bg-[#39489D] text-white disabled:opacity-60 inline-flex items-center gap-2"
              onClick={onSend}
              disabled={!canChat || loading || !input.trim()}
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TranscriptQnA;


