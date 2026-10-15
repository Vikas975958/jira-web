"use client";

import React, { useEffect, useState } from "react";

const loadingMessages = [
  "Loading data, please wait...",
  "Preparing workspace...",
  "Processing, almost ready...",
  "Fetching information...",
];

export default function Loader({
  height,
  size = 36,
  color = "#0F766E",
  onlySpinner = false,
  message: customMessage,
}) {
  const [message, setMessage] = useState(customMessage || "");

  useEffect(() => {
    if (!customMessage) {
      const randomMessage =
        loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
      setMessage(randomMessage);
    }
  }, [customMessage]);

  return (
    <div
      className={`w-full ${
        height ? `h-[${height}]` : "min-h-[240px] h-full"
      } flex flex-col items-center justify-center gap-3 p-6 select-none`}
    >
      <div
        className="border-3 rounded-full animate-spin"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderColor: `${color} transparent transparent transparent`,
          borderTopColor: color,
        }}
      />
      {!onlySpinner && (
        <p className="text-xs font-semibold text-slate-500 tracking-wide">
          {message}
        </p>
      )}
    </div>
  );
}
