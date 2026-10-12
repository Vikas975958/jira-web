"use client";

import React from "react";
import {
  FiUser,
  FiMail,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiAlertCircle,
  FiRefreshCw,
  FiShield,
  FiUsers,
  FiUserPlus,
} from "react-icons/fi";
import { getNameInitials } from "@/utils/commonFunction";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function ProfilesTable({
  profiles = [],
  loading = false,
  error = null,
  viewerRole = null,
  onRetry,
  onOpenInviteModal,
}) {
  // Helper for role badge styling
  const renderRoleBadge = (role) => {
    const normalized = (role || "").toLowerCase();
    switch (normalized) {
      case MANAGER_ROLE:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/70">
            <FiShield className="w-3 h-3 text-purple-600" />
            Manager
          </span>
        );
      case OWNER_ROLE:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/70">
            <FiShield className="w-3 h-3 text-amber-600" />
            Owner
          </span>
        );
      case MEMBER_ROLE:
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
            <FiUsers className="w-3 h-3 text-blue-600" />
            Member
          </span>
        );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // 1. Loading Skeleton State
  if (loading && (!profiles || profiles.length === 0)) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="h-4 w-36 bg-slate-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-slate-100">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="p-4 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-200" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-32 bg-slate-200 rounded" />
                  <div className="h-2.5 w-44 bg-slate-200 rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-slate-200 rounded" />
              <div className="h-3.5 w-24 bg-slate-200 rounded hidden md:block" />
              <div className="h-3.5 w-20 bg-slate-200 rounded hidden lg:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="w-full bg-white rounded-2xl border border-red-200/80 p-8 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
          <FiAlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">Failed to load profiles</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <FiRefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (!profiles || profiles.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3.5">
          <FiUsers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 mb-1">No profiles found</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
          No team members matched your current filter criteria. Invite members to your organization to get started.
        </p>
        {onOpenInviteModal && (
          <button
            type="button"
            onClick={onOpenInviteModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <FiUserPlus className="w-4 h-4" />
            Invite New User
          </button>
        )}
      </div>
    );
  }

  // 4. Data Table
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4 sm:px-6">User & Email</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4 hidden md:table-cell">Organization</th>
              <th className="py-3 px-4 hidden lg:table-cell">Department / Title</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 sm:px-6 text-right hidden sm:table-cell">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {profiles.map((profile) => {
              const displayName =
                profile.full_name ||
                profile.name ||
                profile.email?.split("@")[0] ||
                "Jira User";
              const initials = getNameInitials(displayName) || "U";
              const orgName = profile.organization_name || "—";
              const deptTitle = [profile.job_title, profile.department]
                .filter(Boolean)
                .join(" · ") || "—";

              return (
                <tr
                  key={profile.id || profile.email}
                  className="hover:bg-slate-50/70 transition-colors group"
                >
                  {/* User name & email */}
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {displayName}
                        </p>
                        <p className="text-slate-500 text-[11px] truncate flex items-center gap-1 mt-0.5">
                          <FiMail className="w-3 h-3 shrink-0 text-slate-400" />
                          {(viewerRole === MANAGER_ROLE || profile.is_owner_protected) && profile.role === OWNER_ROLE
                            ? "[Protected Owner Account]"
                            : profile.email}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {renderRoleBadge(profile.role)}
                  </td>

                  {/* Organization */}
                  <td className="py-3.5 px-4 hidden md:table-cell font-medium text-slate-800 whitespace-nowrap">
                    {orgName}
                  </td>

                  {/* Department & Job Title */}
                  <td className="py-3.5 px-4 hidden lg:table-cell text-slate-600 whitespace-nowrap">
                    {deptTitle}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {profile.status || "Active"}
                    </span>
                  </td>

                  {/* Joined Date */}
                  <td className="py-3.5 px-4 sm:px-6 text-right hidden sm:table-cell text-slate-500 whitespace-nowrap font-mono text-[11px]">
                    {formatDate(profile.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
