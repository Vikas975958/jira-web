"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { FiSend, FiSmile, FiCornerDownLeft, FiSearch, FiX } from "react-icons/fi";

const EMOJI_CATEGORIES = [
  {
    id: "popular",
    name: "Popular & Reactions",
    icon: "🔥",
    emojis: [
      "👍", "👎", "❤️", "🔥", "🎉", "🚀", "👀", "🙌", "👏", "💯", "✅", "⚡",
      "⭐", "💡", "🤝", "🙏", "💪", "✨", "🎯", "🏆", "👌", "😊", "😂", "🤩",
      "🫡", "🥳", "😎", "🤔", "🥺", "😍", "💖", "🌟", "📌", "💬", "☕", "🍕"
    ],
  },
  {
    id: "smileys",
    name: "Smileys & Faces",
    icon: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "🥹", "😊", "😇",
      "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
      "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳", "😏", "😒",
      "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢",
      "😭", "😮‍💨", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨",
      "😰", "😥", "😓", "🤗", "🤔", "🫣", "🤭", "🫢", "🫡", "🤫", "🫠", "🤥",
      "😶", "😐", "😑", "😬", "🫨", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱",
      "😴", "🤤", "😪", "😵", "😵‍💫", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒"
    ],
  },
  {
    id: "gestures",
    name: "Hands & Gestures",
    icon: "👍",
    emojis: [
      "👍", "👎", "👊", "✊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏",
      "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "✋",
      "🤚", "🖐️", "🖖", "👋", "🫲", "🫱", "🫸", "🫷", "🫳", "🫴", "👌", "🤌",
      "🤏", "✍️", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "👃", "🧠", "👀", "👁️"
    ],
  },
  {
    id: "work",
    name: "Work & Office",
    icon: "💼",
    emojis: [
      "💼", "📁", "📂", "📄", "📑", "📊", "📈", "📉", "📌", "📍", "📎", "🔗",
      "📐", "📏", "💻", "🖥️", "⌨️", "🖱️", "🖨️", "📱", "☎️", "📞", "⏰", "⏱️",
      "⏲️", "⏳", "⌛", "📅", "🗓️", "📆", "📝", "✏️", "✒️", "🖊️", "🔍", "🔎",
      "💡", "🔦", "🔒", "🔓", "🔏", "🔐", "🔑", "🗝️", "🏷️", "📦", "📫", "📬"
    ],
  },
  {
    id: "celebration",
    name: "Celebration & Life",
    icon: "🎉",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🎀", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎯",
      "🚀", "🛸", "🌟", "⭐", "✨", "💥", "🔥", "🌈", "☀️", "🌙", "☕", "🍵",
      "🍕", "🍔", "🍟", "🍩", "🍰", "🧁", "🍫", "🍿", "🍻", "🥂", "🍾", "🍷"
    ],
  },
  {
    id: "symbols",
    name: "Symbols & Status",
    icon: "✅",
    emojis: [
      "✅", "✔️", "☑️", "❌", "❎", "⚠️", "⛔", "🚫", "❓", "❔", "❗", "❕",
      "💬", "💭", "🗯️", "💤", "🔔", "🔕", "📢", "📣", "🟢", "🟡", "🔴", "🔵",
      "🟣", "⚪", "⚫", "🟩", "🟨", "🟥", "🟦", "🟪", "⬜", "⬛", "🔶", "🔷",
      "🔺", "🔻", "➕", "➖", "➗", "✖️", "💯", "🆗", "🆙", "🆒", "🆕", "🆓"
    ],
  },
];

const QUICK_TEMPLATES = [
  "Hi! Checking in on project updates.",
  "Could you review the latest task changes?",
  "Available for a quick sync when you're free?",
  "Thanks for the update!",
];

export default function ChatMessageInput({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message...",
}) {
  const [message, setMessage] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [emojiSearch, setEmojiSearch] = useState("");

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

  // Filter emojis based on active category and search
  const filteredCategories = useMemo(() => {
    let cats = EMOJI_CATEGORIES;
    if (activeCategory !== "all") {
      cats = cats.filter((c) => c.id === activeCategory);
    }
    if (!emojiSearch.trim()) return cats;

    const q = emojiSearch.trim().toLowerCase();
    return cats
      .map((cat) => ({
        ...cat,
        emojis: cat.emojis.filter((emoji) => emoji.includes(q) || cat.name.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.emojis.length > 0);
  }, [activeCategory, emojiSearch]);

  const totalEmojiCount = useMemo(() => {
    return EMOJI_CATEGORIES.reduce((acc, cat) => acc + cat.emojis.length, 0);
  }, []);

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

      {/* Rich Emoji Picker Popover with 250+ Emojis */}
      {showEmojis && (
        <div
          ref={emojiRef}
          className="absolute bottom-full mb-2 left-2 sm:left-4 w-[92vw] sm:w-[360px] bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">✨</span>
              <span className="text-xs font-bold text-slate-800">
                Emojis & Reactions
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-50 text-[#0F766E] font-medium border border-teal-200/60">
                {totalEmojiCount}+
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowEmojis(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === "all"
                  ? "bg-[#0F766E] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                  activeCategory === cat.id
                    ? "bg-[#0F766E] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                title={cat.name}
              >
                <span>{cat.icon}</span>
                <span>{cat.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Emoji Grid Scroll Area */}
          <div className="max-h-64 overflow-y-auto pr-1 space-y-3">
            {filteredCategories.map((cat) => (
              <div key={cat.id} className="space-y-1">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-0.5">
                  {cat.name}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {cat.emojis.map((emoji, idx) => (
                    <button
                      key={`${cat.id}-${idx}`}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-lg transition-transform hover:scale-125 cursor-pointer active:scale-95"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 mt-2 border-t border-slate-100 text-center text-[10px] text-slate-400">
            Click any emoji to insert into your message
          </div>
        </div>
      )}

      {/* Main Input Controls */}
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
      </div>
    </div>
  );
}
