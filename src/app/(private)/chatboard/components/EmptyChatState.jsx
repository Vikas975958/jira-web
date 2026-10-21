"use client";

import React from "react";
import { FiMessageSquare, FiUsers, FiFolder, FiShield, FiLock } from "react-icons/fi";

export default function EmptyChatState({ onSelectRoleFilter, onSelectProjectClick }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-50/60 select-none">
      <div className="max-w-md w-full space-y-6">
        {/* Visual Badge / Icon */}
        <div className="relative mx-auto w-16 h-16 rounded-2xl bg-teal-100/70 border border-teal-200/80 flex items-center justify-center shadow-xs">
          <FiMessageSquare className="w-8 h-8 text-[#0F766E]" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-xs">
            <FiLock className="w-3 h-3 text-slate-600" />
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-1.5">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            WorkGrid 1-to-1 Private Messenger
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            Direct and confidential messaging between team members, managers, and project leads. Select an existing conversation or pick a teammate below.
          </p>
        </div>

        {/* Quick Action Suggestions Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-left">
          <button
            type="button"
            onClick={() => onSelectRoleFilter && onSelectRoleFilter("manager")}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-xs transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
                <FiShield className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 group-hover:text-[#0F766E]">
                Chat with Managers
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Connect with project leads, admins, and workspace managers.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onSelectRoleFilter && onSelectRoleFilter("member")}
            className="p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-xs transition-all group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0F766E] flex items-center justify-center group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
                <FiUsers className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-semibold text-slate-800 group-hover:text-[#0F766E]">
                Team Members
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Directly message peers, developers, and team contributors.
            </p>
          </button>
        </div>

        {/* Security / Privacy reassurance banner */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] border border-slate-200/70">
          <FiLock className="w-3 h-3 text-slate-400" />
          <span>Messages are private and visible only to the two participants</span>
        </div>
      </div>
    </div>
  );
}
