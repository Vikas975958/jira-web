"use client";

import React, { useEffect } from "react";
import { FiAlertTriangle, FiTrash2, FiX, FiUser } from "react-icons/fi";
import Portal from "@/components/Portal";
import { formatTaskKey } from "@/utils/commonFunction";

const priorityStyles = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusLabels = {
  backlog: "Backlog",
  todo: "To Do",
  "in-progress": "In Progress",
  review: "In Review",
  done: "Done",
};

export default function DeleteTaskConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  task = null,
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

  if (!isOpen || !task) return null;

  const priorityClass =
    priorityStyles[task.priority?.toLowerCase()] || priorityStyles.medium;
  const statusDisplay = statusLabels[task.status] || task.status || "To Do";

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
                <h3 className="text-base font-bold text-slate-900">Delete Issue</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
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
              Are you sure you want to permanently delete this issue? All tracking data, comments, and member assignments associated with this task will be permanently removed.
            </p>

            {/* Target Task Card Preview */}
            <div className="bg-slate-50/80 border border-slate-200/90 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-[#0F766E] bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-md">
                  {formatTaskKey(task)}
                </span>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded-md uppercase font-semibold text-[9px] border ${priorityClass}`}
                  >
                    {task.priority || "medium"}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize bg-slate-200/70 text-slate-700">
                    {statusDisplay}
                  </span>
                </div>
              </div>

              <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                {task.title}
              </h4>

              {task.description && (
                <p className="text-[11px] text-slate-500 line-clamp-2">
                  {task.description}
                </p>
              )}

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5 truncate">
                  <FiUser className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{task.assignee || "Unassigned"}</span>
                </div>
                <span className="text-[10px] text-red-600 font-medium shrink-0">Permanent deletion</span>
              </div>
            </div>
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
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <FiTrash2 className="w-3.5 h-3.5" />
                  <span>Delete Issue</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
