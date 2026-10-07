"use client";

import React, { useEffect } from "react";
import { FiAlertTriangle, FiLogOut, FiX } from "react-icons/fi";
import { getNameInitials } from "@/utils/commonFunction";

export default function LogoutConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  user,
}) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const userName = user?.name || user?.email?.split("@")[0] || "Team Member";
  const userEmail = user?.email || "No email available";
  const userInitials = getNameInitials(userName) || "U";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none animate-fadeIn"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
              <FiAlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Confirm Log Out</h3>
              <p className="text-xs text-slate-500">Are you sure you want to end your session?</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            You will need to sign in again to access your Jira boards, sprint tasks, and project updates.
          </p>

          {/* User Profile Card */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{userName}</p>
              <p className="text-[11px] text-slate-500 truncate">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8H4z"
                  />
                </svg>
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <FiLogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
