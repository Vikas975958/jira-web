"use client";

import React, { useEffect } from "react";
import { FiAlertTriangle, FiTrash2, FiX, FiUser, FiMail } from "react-icons/fi";
import Portal from "@/components/Portal";

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = "Confirm Deletion",
  subtitle = "This action cannot be undone.",
  message = "Are you sure you want to proceed with this deletion?",
  confirmButtonText = "Delete",
  item = null,
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

  const itemName = item?.name || item?.full_name || item?.profiles?.full_name || item?.email || "";
  const itemEmail = item?.email || item?.profiles?.email || "";
  const itemRole = item?.role || item?.intended_role || "";
  const initial = (itemName || itemEmail || "U").charAt(0).toUpperCase();

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none animate-fadeIn"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      >
        <div
          className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-scaleUp"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                <FiAlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="text-xs text-slate-500">{subtitle}</p>
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
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {message}
            </p>

            {/* Target Item Preview Card */}
            {(itemName || itemEmail) && (
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0 border border-red-200/70">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {itemName}
                    </p>
                    {itemEmail && itemEmail !== itemName && (
                      <p className="text-[11px] text-slate-500 truncate font-mono">
                        {itemEmail}
                      </p>
                    )}
                  </div>
                </div>

                {itemRole && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                    {itemRole}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-slate-100 bg-slate-50/40">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <FiTrash2 className="w-3.5 h-3.5" />
                  <span>{confirmButtonText}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
