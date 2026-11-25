"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiX, FiSend, FiMessageSquare, FiAlertCircle, FiRefreshCw } from "react-icons/fi";
import Portal from "@/components/Portal";

/**
 * Robot Avatar Icon component matching the floating chat assistant style
 */
function RobotAvatar({ className = "w-7 h-7" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer Glow / Halo */}
      <circle cx="24" cy="24" r="22" fill="#EBF4FF" />
      <circle cx="24" cy="24" r="20" stroke="#3B82F6" strokeWidth="2" strokeDasharray="3 3" />

      {/* Robot Antenna */}
      <circle cx="24" cy="9" r="2.5" fill="#2563EB" />
      <line x1="24" y1="11.5" x2="24" y2="15" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" />

      {/* Robot Head Body */}
      <rect x="11" y="15" width="26" height="20" rx="8" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />

      {/* Screen / Visor */}
      <rect x="14.5" y="18.5" width="19" height="13" rx="5" fill="#0F172A" />

      {/* Eyes */}
      <circle cx="19.5" cy="24" r="2.2" fill="#38BDF8" className="animate-pulse" />
      <circle cx="28.5" cy="24" r="2.2" fill="#38BDF8" className="animate-pulse" />

      {/* Headphones / Ears */}
      <rect x="8" y="21" width="3.5" height="8" rx="1.5" fill="#2563EB" />
      <rect x="36.5" y="21" width="3.5" height="8" rx="1.5" fill="#2563EB" />

      {/* Chest Badge / Mini Body */}
      <path
        d="M17 35C17 35 19 39 24 39C29 39 31 35 31 35"
        stroke="#3B82F6"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm WorkGrid AI. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom whenever messages or loading state change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      // Auto-focus input when opened
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [messages, loading, isOpen]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const newMessages = [
      ...messages,
      {
        role: "user",
        content: userText,
      },
    ];

    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
      });

      let data = {};
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textError = await response.text();
        throw new Error(textError || `Server responded with status ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate AI response.");
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No response received.",
        },
      ]);
    } catch (err) {
      console.error("AI Assistant request error:", err);
      setError(err.message || "Failed to communicate with AI Assistant.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Portal>
      {/* Floating Action Button at Bottom-Right */}
      <div className="fixed bottom-6 right-6 z-50 select-none">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label={isOpen ? "Close WorkGrid AI" : "Open WorkGrid AI"}
          className="relative group p-1.5 bg-white rounded-full shadow-lg hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-200 cursor-pointer flex items-center justify-center"
        >
          <RobotAvatar className="w-11 h-11" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>
        </button>
      </div>

      {/* Floating Chat Window Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="WorkGrid AI Chat"
          className="fixed bottom-22 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[390px] h-[550px] max-h-[80vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-white border-b border-slate-100 select-none">
            <div className="flex items-center gap-2.5">
              <div className="p-1 rounded-full bg-blue-50 border border-blue-200">
                <RobotAvatar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 text-sm leading-tight">
                  WorkGrid AI
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-[11px] text-slate-500 font-medium">Online</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              title="Close chat"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Conversation Messages Container (Dark navy background matching design) */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0c1527] space-y-4">
            {messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={index}
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] text-[13.5px] leading-relaxed p-3.5 rounded-2xl shadow-sm whitespace-pre-wrap break-words ${
                      isAssistant
                        ? "bg-white text-slate-800 rounded-tl-xs"
                        : "bg-blue-600 text-white rounded-tr-xs"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-700 rounded-2xl rounded-tl-xs p-3.5 shadow-sm max-w-[85%] text-xs flex items-center gap-2">
                  <span className="text-slate-500 font-medium">AI is thinking</span>
                  <div className="flex space-x-1 items-center">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-rose-950/80 border border-rose-600/50 rounded-xl text-rose-200 text-xs flex items-start gap-2">
                <FiAlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-rose-400 hover:text-rose-200 text-xs font-semibold ml-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-slate-100 flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading}
              className="flex-1 text-sm bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-800 border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-sm"
            >
              <FiSend className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </Portal>
  );
}
