"use client";

import React from "react";
import { FiSearch, FiFilter, FiX } from "react-icons/fi";
import { MEMBER_ROLE, MANAGER_ROLE } from "@/utils/constants";

/**
 * Filter bar component for profiles table.
 * Supports switching between role tabs (All, Manager, Member) and text search.
 */
export default function ProfileFilters({
  activeRole = "all",
  onRoleChange,
  searchTerm = "",
  onSearchChange,
  counts = { all: 0, manager: 0, member: 0 },
}) {
  const filterTabs = [
    { key: "all", label: "All Users", count: counts.all },
    { key: MANAGER_ROLE, label: "Managers", count: counts.manager },
    { key: MEMBER_ROLE, label: "Members", count: counts.member },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-4">
      {/* Role Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/70 w-fit">
        {filterTabs.map((tab) => {
          const isActive = activeRole === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onRoleChange && onRoleChange(tab.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-blue-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive
                      ? "bg-blue-100 text-blue-800"
                      : "bg-slate-200/80 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative flex-1 sm:max-w-xs">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <FiSearch className="w-3.5 h-3.5" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
          placeholder="Filter by name, email, or org..."
          className="w-full h-9 pl-9 pr-8 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 transition-all placeholder:text-slate-400 shadow-2xs"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange && onSearchChange("")}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            title="Clear search"
          >
            <FiX className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
