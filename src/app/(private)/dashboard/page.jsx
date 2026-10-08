"use client";

import React, { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import {
  FiUserPlus,
  FiUsers,
  FiShield,
  FiGlobe,
  FiRefreshCw,
  FiLayers,
} from "react-icons/fi";
import useProfiles from "@/hooks/useProfiles";
import ProfilesTable from "@/components/profiles/ProfilesTable";
import ProfileFilters from "@/components/profiles/ProfileFilters";
import AddProfileModal from "@/components/profiles/AddProfileModal";

export default function DashboardPage() {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [searchTerm, setSearchTerm] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Hook for profiles with role filter
  const {
    profiles,
    loading,
    error,
    roleFilter,
    setRoleFilter,
    refetch,
  } = useProfiles("all");

  // Calculate counts for badges and statistics cards
  const counts = useMemo(() => {
    let total = profiles.length;
    let managers = 0;
    let members = 0;
    const orgs = new Set();

    profiles.forEach((p) => {
      const r = (p.role || "").toLowerCase();
      if (r === "manager") managers++;
      else if (r === "member") members++;
      if (p.organization_name) orgs.add(p.organization_name);
    });

    return {
      all: total,
      manager: managers,
      member: members,
      organizations: orgs.size || (user?.organization_name ? 1 : 0),
    };
  }, [profiles, user]);

  // Filter profiles by search text in real-time
  const filteredProfiles = useMemo(() => {
    if (!searchTerm.trim()) return profiles;
    const q = searchTerm.toLowerCase().trim();
    return profiles.filter((p) => {
      const name = (p.full_name || p.name || "").toLowerCase();
      const email = (p.email || "").toLowerCase();
      const org = (p.organization_name || "").toLowerCase();
      const role = (p.role || "").toLowerCase();
      const dept = (p.department || "").toLowerCase();
      const title = (p.job_title || "").toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        org.includes(q) ||
        role.includes(q) ||
        dept.includes(q) ||
        title.includes(q)
      );
    });
  }, [profiles, searchTerm]);

  return (
    <div className="min-h-full bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Profiles & Access Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              {profiles.length} Users
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage organization members, assign roles, and invite new team members to Jira.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-all cursor-pointer border border-slate-200 bg-white shadow-2xs"
            title="Refresh list"
          >
            <FiRefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <FiUserPlus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Profiles */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiUsers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Users
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {counts.all}
            </p>
          </div>
        </div>

        {/* Managers */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FiShield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Managers
            </p>
            <p className="text-xl sm:text-2xl font-black text-purple-950">
              {counts.manager}
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <FiLayers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Members
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {counts.member}
            </p>
          </div>
        </div>

        {/* Organization */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiGlobe className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Organization
            </p>
            <p className="text-sm sm:text-base font-bold text-slate-900 truncate">
              {user?.organization_name || "Jira Cloud"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Section: Filters & Table */}
      <div className="space-y-4">
        {/* Filters */}
        <ProfileFilters
          activeRole={roleFilter}
          onRoleChange={setRoleFilter}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          counts={counts}
        />

        {/* Profiles Table */}
        <ProfilesTable
          profiles={filteredProfiles}
          loading={loading}
          error={error}
          onRetry={refetch}
          onOpenInviteModal={() => setIsInviteModalOpen(true)}
        />
      </div>

      {/* Add User / Invite Modal */}
      <AddProfileModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}