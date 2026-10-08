"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import {
  FiPlus,
  FiUsers,
  FiGlobe,
  FiCalendar,
  FiSettings,
  FiChevronRight,
  FiShield,
  FiZap,
  FiLayers,
  FiActivity,
  FiClock,
  FiLogOut,
} from "react-icons/fi";
import JiraLogo from "@/components/JiraLogo";
import organizationService from "@/services/organization.service";
import authService from "@/services/auth.service";
import { emptyStore } from "@/store/rootReducer";
import { useOrganization } from "@/context/OrganizationContext";

// ─────────────────────────────────────────────────────────
// Skeleton loader component for smooth loading states
// ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-slate-50/50 p-6 sm:p-8 lg:p-10 space-y-8 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 bg-slate-200 rounded-lg w-64" />
          <div className="h-4 bg-slate-200 rounded-lg w-96" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200/80" />
        ))}
      </div>
      <div className="h-64 bg-white rounded-2xl border border-slate-200/80" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Empty state when user has no organizations
// ─────────────────────────────────────────────────────────
function NoOrganizationView({ userName, onCreateOrg, onLogout }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 p-6">
      {/* Top right sign out */}
      {onLogout && (
        <div className="absolute top-5 right-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
          >
            <FiLogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-lg text-center space-y-8 animate-fadeIn">
        {/* Decorative Icon */}
        <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/25 rotate-3 hover:rotate-0 transition-transform duration-500">
          <FiGlobe className="w-11 h-11 text-white" />
        </div>

        {/* Welcome Text */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Welcome, {userName || "there"}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
            You don&apos;t belong to any organization yet. Create one to start
            managing your projects, sprints, and team.
          </p>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={onCreateOrg}
          className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer text-sm sm:text-base group"
        >
          <FiPlus className="w-5 h-5 transition-transform group-hover:rotate-90 duration-300" />
          <span>Create Organization</span>
        </button>

        {/* Subtle feature hints */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200/60 max-w-sm mx-auto">
          <div className="text-center space-y-1.5">
            <div className="w-9 h-9 mx-auto rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <FiLayers className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Projects
            </p>
          </div>
          <div className="text-center space-y-1.5">
            <div className="w-9 h-9 mx-auto rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <FiUsers className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Teams
            </p>
          </div>
          <div className="text-center space-y-1.5">
            <div className="w-9 h-9 mx-auto rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FiZap className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Sprints
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Organization Dashboard (when user has an org)
// ─────────────────────────────────────────────────────────
function OrganizationDashboard({ membership, members }) {
  const org = membership?.organizations;
  const role = membership?.role;

  const memberCount = members?.length || 0;
  const ownerCount = members?.filter((m) => m.role === "owner")?.length || 0;
  const managerCount = members?.filter((m) => m.role === "manager")?.length || 0;
  const regularCount = members?.filter((m) => m.role === "member")?.length || 0;

  const roleBadgeClasses = {
    owner: "bg-amber-100 text-amber-800 border-amber-200",
    manager: "bg-purple-100 text-purple-800 border-purple-200",
    member: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const joinedDate = membership?.joined_at
    ? new Date(membership.joined_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  const createdDate = org?.created_at
    ? new Date(org.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  return (
    <div className="min-h-full bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn">
      {/* Organization Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-4">
          {/* Org Avatar */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#0747A6] flex items-center justify-center text-white text-xl font-black shadow-lg shadow-blue-500/20 shrink-0">
            {org?.name?.charAt(0)?.toUpperCase() || "O"}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {org?.name || "Organization"}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  roleBadgeClasses[role] || roleBadgeClasses.member
                }`}
              >
                {role}
              </span>
              {org?.status === "active" && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {org?.description || "Manage your projects, teams, and sprints from here."}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Members */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiUsers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Members
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {memberCount}
            </p>
          </div>
        </div>

        {/* Owners */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiShield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Owners
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {ownerCount}
            </p>
          </div>
        </div>

        {/* Managers */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <FiActivity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Managers
            </p>
            <p className="text-xl sm:text-2xl font-black text-purple-950">
              {managerCount}
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow">
          <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
            <FiLayers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Members
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {regularCount}
            </p>
          </div>
        </div>
      </div>

      {/* Organization Info & Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Organization Details Card */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Organization Details
            </h3>
            <FiSettings className="w-4 h-4 text-slate-400" />
          </div>
          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                Name
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {org?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                Slug
              </p>
              <p className="text-sm text-slate-600 font-mono">
                {org?.slug || "—"}
              </p>
            </div>
            {org?.website && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                  Website
                </p>
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {org.website}
                </a>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                Created
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                {createdDate}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                You joined
              </p>
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <FiClock className="w-3.5 h-3.5 text-slate-400" />
                {joinedDate}
              </p>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Team Members
              <span className="ml-2 text-xs font-semibold text-slate-400">
                ({memberCount})
              </span>
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
            {members && members.length > 0 ? (
              members.map((member) => (
                <div
                  key={member.id}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 text-xs font-bold shrink-0 overflow-hidden">
                    {member.profiles?.profile_photo ? (
                      <img
                        src={member.profiles.profile_photo}
                        alt={member.profiles.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      member.profiles?.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2) || "?"
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {member.profiles?.full_name || "Unknown"}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {member.profiles?.email || "—"}
                    </p>
                  </div>
                  {/* Role Badge */}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      roleBadgeClasses[member.role] || roleBadgeClasses.member
                    }`}
                  >
                    {member.role}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center text-sm text-slate-400">
                No team members found.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Dashboard Page
// ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const { organizations: orgMemberships, loadingOrgs } = useOrganization();
  const [members, setMembers] = useState([]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (orgMemberships && orgMemberships.length > 0) {
        const orgId = orgMemberships[0]?.organizations?.id || orgMemberships[0]?.id;
        if (orgId) {
          try {
            const orgMembers = await organizationService.getOrganizationMembers(orgId);
            setMembers(orgMembers);
          } catch (err) {
            console.error("Failed to fetch members:", err);
          }
        }
      }
    };

    fetchMembers();
  }, [orgMemberships]);

  const dispatch = useDispatch();

  const handleLogout = async () => {
    try {
      await authService.signOut();
    } catch (_) {}
    Cookies.remove("token", { path: "/" });
    dispatch(emptyStore());
    router.push("/signin");
  };

  const handleCreateOrg = () => {
    router.push("/dashboard/create-organization");
  };

  // Loading state
  if (loadingOrgs) {
    return <DashboardSkeleton />;
  }

  // No organizations — show empty state
  if (!orgMemberships || orgMemberships.length === 0) {
    return (
      <NoOrganizationView
        userName={user?.full_name || user?.name}
        onCreateOrg={handleCreateOrg}
        onLogout={handleLogout}
      />
    );
  }

  // Has organization(s) — show the dashboard
  return (
    <OrganizationDashboard
      membership={orgMemberships[0]}
      members={members}
    />
  );
}