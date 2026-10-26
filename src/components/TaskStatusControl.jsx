"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FiCircle,
  FiClock,
  FiCheckCircle,
  FiEye,
  FiLayers,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCheck,
} from "react-icons/fi";
import Portal from "@/components/Portal";

export const TASK_STATUS_CONFIG = {
  backlog: {
    id: "backlog",
    label: "Backlog",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/80",
    dotClass: "bg-slate-400",
    activeClass: "bg-slate-100 text-slate-900 font-semibold",
    Icon: FiLayers,
  },
  todo: {
    id: "todo",
    label: "To Do",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100/80",
    dotClass: "bg-sky-500",
    activeClass: "bg-sky-50 text-sky-900 font-semibold",
    Icon: FiCircle,
  },
  "in-progress": {
    id: "in-progress",
    label: "In Progress",
    badgeClass: "bg-teal-50 text-[#0F766E] border-teal-200 hover:bg-teal-100/80",
    dotClass: "bg-[#0F766E]",
    activeClass: "bg-teal-50 text-[#0F766E] font-semibold",
    Icon: FiClock,
  },
  review: {
    id: "review",
    label: "In Review",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100/80",
    dotClass: "bg-purple-500",
    activeClass: "bg-purple-50 text-purple-900 font-semibold",
    Icon: FiEye,
  },
  done: {
    id: "done",
    label: "Done",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80",
    dotClass: "bg-emerald-500",
    activeClass: "bg-emerald-50 text-emerald-900 font-semibold",
    Icon: FiCheckCircle,
  },
};

export const STATUS_SEQUENCE = ["backlog", "todo", "in-progress", "review", "done"];

function normalizeStatus(rawStatus) {
  if (!rawStatus) return "todo";
  const lower = String(rawStatus).toLowerCase().trim();
  if (TASK_STATUS_CONFIG[lower]) return lower;
  if (lower === "to do") return "todo";
  if (lower === "in review") return "review";
  return "todo";
}

/**
 * TaskStatusControl
 * A compact, Jira/Linear-inspired task status changer with:
 * - Refined compact status pill showing state icon, label, and chevron
 * - Quick step navigation arrows (< and >) sized perfectly to fit card width
 * - Pristine floating status dropdown menu
 */
export default function TaskStatusControl({
  status,
  onChange,
  disabled = false,
  loading = false,
  showQuickSteps = true,
  className = "",
}) {
  const currentKey = normalizeStatus(status);
  const currentConfig = TASK_STATUS_CONFIG[currentKey] || TASK_STATUS_CONFIG.todo;
  const CurrentIcon = currentConfig.Icon;

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, openUpward: false });

  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const currentIndex = STATUS_SEQUENCE.indexOf(currentKey);
  const prevStatus = currentIndex > 0 ? STATUS_SEQUENCE[currentIndex - 1] : null;
  const nextStatus =
    currentIndex < STATUS_SEQUENCE.length - 1 ? STATUS_SEQUENCE[currentIndex + 1] : null;

  const updateDropdownPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = 200;
    const menuWidth = 160;

    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < menuHeight && rect.top > menuHeight;

    let top = openUpward ? rect.top - menuHeight - 4 : rect.bottom + 4;
    let left = rect.left;

    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }
    if (left < 10) {
      left = 10;
    }

    setDropdownPos({
      top: top + window.scrollY,
      left: left + window.scrollX,
      openUpward,
    });
  }, []);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (disabled || loading) return;
    if (!isOpen) {
      updateDropdownPosition();
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  };

  const handleSelect = (nextKey, e) => {
    e.stopPropagation();
    setIsOpen(false);
    if (nextKey !== currentKey && typeof onChange === "function") {
      onChange(nextKey);
    }
  };

  const handleQuickStep = (targetStatus, e) => {
    e.stopPropagation();
    if (disabled || loading || !targetStatus) return;
    if (typeof onChange === "function") {
      onChange(targetStatus);
    }
  };

  // Close on outside click or scroll or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e) => {
      if (
        triggerRef.current?.contains(e.target) ||
        dropdownRef.current?.contains(e.target)
      ) {
        return;
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      setIsOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div
      className={`relative inline-flex items-center justify-between w-full gap-1 min-w-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Compact Status Pill Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || loading}
        onClick={handleToggle}
        title={loading ? "Updating status..." : `Status: ${currentConfig.label} (Click to change)`}
        className={`inline-flex items-center justify-between gap-1 h-5.5 px-1.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer shadow-2xs hover:shadow-xs active:scale-[0.98] min-w-0 max-w-[calc(100%-40px)] ${
          currentConfig.badgeClass
        } ${disabled || loading ? "opacity-75 cursor-wait" : ""}`}
      >
        <div className="flex items-center gap-1 truncate">
          {loading ? (
            <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
          ) : (
            <CurrentIcon className="w-2.5 h-2.5 shrink-0" />
          )}
          <span className="truncate">{loading ? "Updating..." : currentConfig.label}</span>
        </div>
        {!loading && (
          <FiChevronDown
            className={`w-2.5 h-2.5 shrink-0 opacity-60 transition-transform duration-150 ${
              isOpen ? "rotate-180 opacity-100" : ""
            }`}
          />
        )}
      </button>

      {/* Compact Quick Step Navigation Arrows */}
      {showQuickSteps && (
        <div className="flex items-center bg-slate-50 p-0.5 rounded-md border border-slate-200/70 shrink-0">
          {/* Previous Stage Button */}
          <button
            type="button"
            disabled={disabled || !prevStatus}
            onClick={(e) => handleQuickStep(prevStatus, e)}
            title={
              prevStatus
                ? `Move to ${TASK_STATUS_CONFIG[prevStatus]?.label}`
                : "Already at initial status"
            }
            className={`w-4 h-4 flex items-center justify-center rounded-[5px] text-slate-500 transition-all ${
              prevStatus && !disabled
                ? "hover:bg-white hover:text-slate-800 hover:shadow-2xs cursor-pointer active:scale-90"
                : "opacity-25 cursor-not-allowed"
            }`}
          >
            <FiChevronLeft className="w-2.5 h-2.5" />
          </button>

          {/* Next Stage Button */}
          <button
            type="button"
            disabled={disabled || !nextStatus}
            onClick={(e) => handleQuickStep(nextStatus, e)}
            title={
              nextStatus
                ? `Move to ${TASK_STATUS_CONFIG[nextStatus]?.label}`
                : "Already completed"
            }
            className={`w-4 h-4 flex items-center justify-center rounded-[5px] text-slate-500 transition-all ${
              nextStatus && !disabled
                ? "hover:bg-[#0F766E] hover:text-white hover:shadow-2xs cursor-pointer active:scale-90"
                : "opacity-25 cursor-not-allowed"
            }`}
          >
            <FiChevronRight className="w-2.5 h-2.5" />
          </button>
        </div>
      )}

      {/* Portaled Custom Status Menu */}
      {isOpen && (
        <Portal>
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: `${dropdownPos.top}px`,
              left: `${dropdownPos.left}px`,
              zIndex: 999999,
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-40 bg-white rounded-lg border border-slate-200/90 shadow-xl py-1 px-1 animate-in fade-in zoom-in-95 duration-150 select-none"
          >
            <div className="px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase text-slate-400 border-b border-slate-100 mb-0.5">
              Change Status
            </div>

            <div className="space-y-0.5">
              {STATUS_SEQUENCE.map((key) => {
                const conf = TASK_STATUS_CONFIG[key];
                const isSelected = key === currentKey;
                const StatusIcon = conf.Icon;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => handleSelect(key, e)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer group text-left ${
                      isSelected
                        ? `${conf.activeClass} shadow-2xs`
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conf.dotClass}`} />
                      <StatusIcon className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100" />
                      <span className="truncate">{conf.label}</span>
                    </div>

                    {isSelected && (
                      <FiCheck className="w-3 h-3 shrink-0 text-[#0F766E]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
