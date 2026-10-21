"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiSend, FiSmile, FiCornerDownLeft } from "react-icons/fi";

const QUICK_EMOJIS = ["👍", "❤️", "🎉", "🚀", "😊", "🔥", "👀", "🙌", "👏", "💯", "✅", "⚡"];

const QUICK_TEMPLATES = [
  "Hi! Checking in on project updates.",
  "Could you review the latest task changes?",
  "Available for a quick sync when you're free?",
  "Thanks for the update!",
];

export default function ChatMessageInput({ onSendMessage, disabled = false, placeholder = "Type your message..." }) {
  const [message, setMessage] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);
  const templatesRef = useRef(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const nextHeight = Math.min(textareaRef.current.scrollHeight, 120);
      textareaRef.current.style.height = `${Math.max(nextHeight, 40)}px`;
    }
  }, [message]);

  // Click outside to close emoji/template popups
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojis(false);
      }
      if (templatesRef.current && !templatesRef.current.contains(e.target)) {
        setShowTemplates(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!message.trim() || disabled) return;
    onSendMessage(message.trim());
    setMessage("");
    setShowEmojis(false);
    setShowTemplates(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojis(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleTemplateClick = (text) => {
    setMessage(text);
    setShowTemplates(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className="p-3 bg-white border-t border-slate-200/80 relative">
      {/* Quick Template Suggestion Dropdown */}
      {showTemplates && (
        <div
          ref={templatesRef}
          className="absolute bottom-full mb-2 left-4 right-4 sm:right-auto sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl p-2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-2 py-1 mb-1">
            Quick Templates
          </div>
          <div className="space-y-1">
            {QUICK_TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTemplateClick(tmpl)}
                className="w-full text-left text-xs text-slate-700 hover:text-[#0F766E] hover:bg-teal-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                {tmpl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojis && (
        <div
          ref={emojiRef}
          className="absolute bottom-full mb-2 left-4 bg-white border border-slate-200 rounded-xl shadow-xl p-2.5 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Add Reaction / Emoji
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-lg transition-transform hover:scale-120 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end gap-2 bg-slate-50 border border-slate-200/90 rounded-2xl px-3 py-1.5 focus-within:border-[#0F766E] focus-within:ring-2 focus-within:ring-teal-600/15 focus-within:bg-white transition-all shadow-2xs">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojis((prev) => !prev)}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0 mb-0.5 cursor-pointer ${
            showEmojis ? "text-[#0F766E] bg-teal-50" : ""
          }`}
          title="Add emoji"
        >
          <FiSmile className="w-5 h-5" />
        </button>

        {/* Templates Button */}
        <button
          type="button"
          onClick={() => setShowTemplates((prev) => !prev)}
          className={`px-2 py-1 rounded-md text-[11px] font-medium text-slate-500 hover:text-[#0F766E] hover:bg-teal-50 transition-colors shrink-0 mb-1 border border-slate-200/70 cursor-pointer ${
            showTemplates ? "text-[#0F766E] bg-teal-50 border-teal-200" : ""
          }`}
          title="Choose a quick message template"
        >
          Quick Prompts
        </button>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden resize-none py-2 px-1 max-h-32 leading-relaxed"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className={`p-2 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 cursor-pointer ${
            message.trim() && !disabled
              ? "bg-[#0F766E] hover:bg-[#0D655E] text-white shadow-xs active:scale-95"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
          title="Send message (Enter)"
        >
          <FiSend className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <FiCornerDownLeft className="w-2.5 h-2.5" />
          Press <kbd className="px-1 py-0.2 bg-slate-100 rounded border border-slate-200 font-mono text-[9px]">Enter</kbd> to send, <kbd className="px-1 py-0.2 bg-slate-100 rounded border border-slate-200 font-mono text-[9px]">Shift+Enter</kbd> for newline
        </span>
        <span>End-to-end 1-to-1 private chat</span>
      </div>
    </div>
  );
}
