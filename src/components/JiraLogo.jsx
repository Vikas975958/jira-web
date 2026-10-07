import React from "react";

export default function JiraLogo({ className = "w-8 h-8", showText = true, textColor = "text-slate-900" }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className={`relative flex items-center justify-center shrink-0 ${className}`}>
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-sm"
        >
          <path
            d="M45.6 23.36L25.28 3.04C24.8 2.56 24.16 2.24 23.44 2.24C22.72 2.24 22.08 2.56 21.6 3.04L13.76 10.88L24.8 21.92L31.68 15.04L45.6 23.36Z"
            fill="#0052CC"
          />
          <path
            d="M31.68 15.04L24.8 21.92L10.88 35.84C10.4 36.32 9.76 36.64 9.04 36.64C8.32 36.64 7.68 36.32 7.2 35.84L2.4 31.04C1.92 30.56 1.6 29.92 1.6 29.2C1.6 28.48 1.92 27.84 2.4 27.36L21.6 8.16L31.68 15.04Z"
            fill="#2684FF"
          />
          <path
            d="M24.8 21.92L13.76 32.96L21.6 40.8C22.08 41.28 22.72 41.6 23.44 41.6C24.16 41.6 24.8 41.28 25.28 40.8L45.6 20.48L31.68 15.04L24.8 21.92Z"
            fill="#0052CC"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`text-xl font-bold tracking-tight ${textColor}`}>
              Jira
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold bg-blue-100 text-blue-700 uppercase tracking-wider">
              Cloud
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
