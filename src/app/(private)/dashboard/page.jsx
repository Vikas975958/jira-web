"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { toast } from "react-toastify";
import {
  FiPlus,
  FiUsers,
  FiGlobe,
  FiCalendar,
  FiSettings,
  FiShield,
  FiZap,
  FiLayers,
  FiActivity,
  FiClock,
  FiLogOut,
  FiUserPlus,
  FiMail,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiCopy,
  FiExternalLink,
  FiSearch,
  FiFilter,
  FiChevronRight,
  FiMessageSquare,
  FiPhone,
  FiMapPin,
  FiDollarSign,
  FiTrash2,
  FiRefreshCw,
} from "react-icons/fi";
import organizationService from "@/services/organization.service";
import authService from "@/services/auth.service";
import taskService from "@/services/task.service";
import { emptyStore } from "@/store/rootReducer";
import AddMemberModal from "@/components/AddMemberModal";
import JiraLogo from "@/components/JiraLogo";
import { useOrganization } from "@/context/OrganizationContext";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

// ─────────────────────────────────────────────────────────
// Skeleton loader
// ─────────────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-full bg-slate-50/50 p-6 sm:p-8 space-y-6 animate-pulse select-none">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-slate-200 rounded-xl w-64" />
          <div className="h-4 bg-slate-200 rounded-lg w-96" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
          <div className="h-10 w-28 bg-slate-200 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-white rounded-2xl border border-slate-200/80" />
        ))}
      </div>
      <div className="h-96 bg-white rounded-2xl border border-slate-200/80" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// View when user has no organization yet
// Displays welcome notice and direct Create Organization prompt
// ─────────────────────────────────────────────────────────
function NoOrganizationView({ userName, userEmail, userInvitations, onCreateOrg, onLogout }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 p-6 sm:p-10 flex flex-col justify-between items-center">
      {/* Top minimal header bar */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <JiraLogo className="w-7 h-7" textColor="text-slate-900" />
        </div>
        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-xs text-slate-500 hidden sm:inline-block">
              {userEmail}
            </span>
          )}
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <FiLogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-2xl space-y-8 animate-fadeIn my-auto">
        {/* Pending Invitations Banner if invited */}
        {userInvitations && userInvitations.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
                <FiClock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900">
                  Pending Organization Invitations ({userInvitations.length})
                </h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  You have been invited to join the following workspaces. Membership will be activated as soon as an organization admin confirms your request.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {userInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white/80 p-3 rounded-xl border border-amber-200/60 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">
                      {inv.organizations?.name || "Organization"}
                    </span>
                    <span className="ml-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      Role: {inv.request_type}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Status: {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Welcome & Create Organization Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-sm space-y-6">
          <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#0747A6] flex items-center justify-center text-white shadow-xl shadow-blue-500/25">
            <FiGlobe className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome to Jira, {userName || "there"}!
            </h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              You haven&apos;t created or joined an organization yet. Set up your organization to start collaborating with members and managers on agile sprints.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onCreateOrg}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.98] text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer text-sm"
            >
              <FiPlus className="w-5 h-5" />
              <span>Create Organization</span>
            </button>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all cursor-pointer text-sm"
              >
                <FiLogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </div>

          {/* Features highlight */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-100 text-slate-600 text-xs">
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <FiLayers className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-800">Issue Tracking</p>
              <p className="text-[11px] text-slate-400">Custom sprint workflows</p>
            </div>
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                <FiUsers className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-800">Team Control</p>
              <p className="text-[11px] text-slate-400">Members & Managers</p>
            </div>
            <div className="space-y-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <FiShield className="w-4 h-4" />
              </div>
              <p className="font-bold text-slate-800">RLS Security</p>
              <p className="text-[11px] text-slate-400">Multi-tenant protection</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="py-2 text-center text-xs text-slate-400">
        Jira Cloud • Workspace Onboarding
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Organization Dashboard Main View
// ─────────────────────────────────────────────────────────
function OrganizationDashboardContent({
  membership,
  members,
  currentUserId,
  onRefresh,
}) {
  const router = useRouter();
  const org = membership?.organizations;
  const userRole = membership?.role || MEMBER_ROLE;
  const isAuthorizedAdmin = userRole === OWNER_ROLE || userRole === MANAGER_ROLE;

  // Unified Invite Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalRole, setInviteModalRole] = useState(MEMBER_ROLE);

  // Active Tab: 'members' | 'requests' | 'details'
  const [activeTab, setActiveTab] = useState("members");

  useEffect(() => {
    if (userRole === MANAGER_ROLE && activeTab === "details") {
      setActiveTab("members");
    }
  }, [userRole, activeTab]);

  // Requests state
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestTypeFilter, setRequestTypeFilter] = useState("all"); // 'all' | 'member' | 'manager'
  const [requestStatusFilter, setRequestStatusFilter] = useState("all"); // 'all' | 'pending' | 'approved' | 'rejected'
  const [requestSearch, setRequestSearch] = useState("");
  const [processingRequestId, setProcessingRequestId] = useState(null);

  // Fetch Requests
  const loadRequests = useCallback(async () => {
    if (!org?.id) return;
    try {
      setLoadingRequests(true);
      const data = await organizationService.getAllRequests(org.id, {
        currentUserId,
        currentUserRole: userRole,
      });
      setRequests(data);
    } catch (err) {
      console.error("loadRequests error:", err);
    } finally {
      setLoadingRequests(false);
    }
  }, [org?.id, currentUserId, userRole]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Handle Delete Request
  const handleDeleteRequest = async (req) => {
    if (!isAuthorizedAdmin) return;
    if (!confirm(`Are you sure you want to delete this invitation?`)) return;

    setProcessingRequestId(req.id);
    try {
      await organizationService.deleteRequest({
        requestId: req.id,
        type: req.request_type,
      });
      toast.success("Invitation removed.");
      await loadRequests();
    } catch (err) {
      toast.error("Failed to delete invitation.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  // Copy Org Slug URL
  const handleCopyOrgLink = () => {
    if (typeof window !== "undefined" && org?.slug) {
      navigator.clipboard.writeText(`${window.location.origin}/org/${org.slug}`);
      toast.success("Workspace URL copied to clipboard!");
    }
  };

  // Filtered requests - Managers NEVER see manager requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (userRole === MANAGER_ROLE && r.request_type === MANAGER_ROLE) return false;
      const matchesType =
        requestTypeFilter === "all" || r.request_type === requestTypeFilter;
      const matchesStatus =
        requestStatusFilter === "all" || r.status === requestStatusFilter;
      const matchesQuery =
        !requestSearch ||
        r.full_name?.toLowerCase().includes(requestSearch.toLowerCase()) ||
        r.email?.toLowerCase().includes(requestSearch.toLowerCase());
      return matchesType && matchesStatus && matchesQuery;
    });
  }, [requests, requestTypeFilter, requestStatusFilter, requestSearch, userRole]);

  const pendingRequestsCount = useMemo(() => {
    return requests.filter(
      (r) => r.status === "pending" && (userRole !== MANAGER_ROLE || r.request_type !== MANAGER_ROLE)
    ).length;
  }, [requests, userRole]);

  // Displayed members:
  // - Managers see listing of members ONLY who they created themselves
  // - Owners see all members and managers in organisation
  const displayMembers = useMemo(() => {
    if (userRole === MANAGER_ROLE) {
      return (members || []).filter(
        (m) => m.role === MEMBER_ROLE && m.role !== OWNER_ROLE && m.role !== MANAGER_ROLE
      );
    }
    return members || [];
  }, [members, userRole]);

  const ownerMember = useMemo(() => {
    return members?.find((m) => m.role === OWNER_ROLE || m.is_owner) || null;
  }, [members]);

  const memberCount = displayMembers.length;
  const managerCount =
    members?.filter((m) => m.role === MANAGER_ROLE || m.role === OWNER_ROLE)?.length || 0;

  const roleBadgeClasses = {
    owner: "bg-amber-100 text-amber-800 border-amber-200",
    manager: "bg-purple-100 text-purple-800 border-purple-200",
    member: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const statusBadgeClasses = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  return (
    <div className="min-h-full bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 animate-fadeIn select-none">
      {/* ───────────────────────────────────────────────────── */}
      {/* 1. Header Card with Org Details & Primary Action Buttons */}
      {/* ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Org Identity */}
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#0747A6] flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-blue-500/20 shrink-0">
              {org?.logo_url ? (
                <img
                  src={org.logo_url}
                  alt={org.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                org?.name?.charAt(0)?.toUpperCase() || "O"
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {org?.name || "Organization"}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    roleBadgeClasses[userRole] || roleBadgeClasses.member
                  }`}
                >
                  Your Role: {userRole}
                </span>
                {org?.status === "active" && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                )}
              </div>

              {userRole !== MANAGER_ROLE && (
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <button
                    type="button"
                    onClick={handleCopyOrgLink}
                    className="inline-flex items-center gap-1 font-mono text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
                    title="Copy workspace slug"
                  >
                    <span>slug: {org?.slug || "—"}</span>
                    <FiCopy className="w-3 h-3" />
                  </button>
                  {org?.industry && (
                    <span className="inline-flex items-center gap-1">
                      • {org.industry}
                    </span>
                  )}
                  {org?.website && (
                    <a
                      href={org.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      <span>Website</span>
                      <FiExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: Add Member & Add Manager (Owner only) */}
          <div className="flex flex-wrap items-center gap-3 self-stretch lg:self-center">
            {/* Add Member Button */}
            <button
              type="button"
              onClick={() => {
                setInviteModalRole(MEMBER_ROLE);
                setIsInviteModalOpen(true);
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <FiUserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>

            {/* Add Manager Button - Owner Only */}
            {userRole === OWNER_ROLE && (
              <button
                type="button"
                onClick={() => {
                  setInviteModalRole(MANAGER_ROLE);
                  setIsInviteModalOpen(true);
                }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                <FiShield className="w-4 h-4" />
                <span>Add Manager</span>
              </button>
            )}

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                loadRequests();
                onRefresh();
                toast.info("Refreshed organization data.");
              }}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Refresh data"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────── */}
      {/* Workspace Owner Presentation Card (for Manager)       */}
      {/* ───────────────────────────────────────────────────── */}
      {userRole === MANAGER_ROLE && ownerMember && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
              {ownerMember.profiles?.full_name?.charAt(0)?.toUpperCase() || "O"}
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-slate-900">
                  {ownerMember.profiles?.full_name || "Workspace Owner"}
                </span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  Workspace Creator
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono">
                {ownerMember.profiles?.email || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 w-fit">
            <FiShield className="w-3.5 h-3.5 text-amber-600" />
            <span>Workspace Created & Owned By This Administrator</span>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────── */}
      {/* 2. Key Metrics Cards */}
      {/* ───────────────────────────────────────────────────── */}
      <div
        className={
          userRole === MANAGER_ROLE
            ? "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4"
            : "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        }
      >
        {/* Total Active Members */}
        <div
          onClick={() => setActiveTab("members")}
          className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FiUsers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {userRole === MANAGER_ROLE ? "My Active Members" : "Active Members"}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {memberCount}
            </p>
          </div>
        </div>

        {/* Managers Count - Hidden for Managers */}
        {userRole !== MANAGER_ROLE && (
          <div
            onClick={() => setActiveTab("members")}
            className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <FiShield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Managers & Owners
              </p>
              <p className="text-xl sm:text-2xl font-black text-slate-900">
                {managerCount}
              </p>
            </div>
          </div>
        )}

        {/* Pending Requests */}
        <div
          onClick={() => {
            setActiveTab("requests");
            setRequestStatusFilter("pending");
          }}
          className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <FiClock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Pending Requests
              </p>
              {pendingRequestsCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {pendingRequestsCount}
            </p>
          </div>
        </div>

        {/* Total Requests Log */}
        <div
          onClick={() => {
            setActiveTab("requests");
            setRequestStatusFilter("all");
          }}
          className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:shadow-md transition-shadow cursor-pointer"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiActivity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {userRole === MANAGER_ROLE ? "Member Requests Sent" : "All Requests Sent"}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-900">
              {userRole === MANAGER_ROLE
                ? requests.filter((r) => r.request_type !== MANAGER_ROLE).length
                : requests.length}
            </p>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────── */}
      {/* 3. Navigation Tabs: Members, Requests, Org Info */}
      {/* ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-2 overflow-x-auto">
          {/* Active Members Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "members"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FiUsers className="w-4 h-4" />
            <span>{userRole === MANAGER_ROLE ? "Active Members" : "Active Team Members"}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {memberCount}
            </span>
          </button>

          {/* Member & Manager Requests Tab */}
          <button
            type="button"
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "requests"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FiClock className="w-4 h-4" />
            <span>{userRole === MANAGER_ROLE ? "Member Requests" : "Member & Manager Requests"}</span>
            {pendingRequestsCount > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200">
                {pendingRequestsCount} Pending
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                {userRole === MANAGER_ROLE
                  ? requests.filter((r) => r.request_type !== MANAGER_ROLE).length
                  : requests.length}
              </span>
            )}
          </button>

          {/* Organization Info Tab - Hidden for Managers */}
          {userRole !== MANAGER_ROLE && (
            <button
              type="button"
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "details"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              <FiSettings className="w-4 h-4" />
              <span>Organization Profile</span>
            </button>
          )}
        </div>

        {/* ───────────────────────────────────────────────────── */}
        {/* TAB 1: ACTIVE TEAM MEMBERS */}
        {/* Displayed only after approval and assignment steps! */}
        {/* ───────────────────────────────────────────────────── */}
        {activeTab === "members" && (
          <div className="p-5 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {userRole === MANAGER_ROLE
                    ? "Active Members (Created by You)"
                    : "Confirmed Members & Managers"}
                </h3>
                <p className="text-xs text-slate-500">
                  {userRole === MANAGER_ROLE
                    ? "Team members invited by you who have completed signup and joined."
                    : "Users who have completed signup and have been approved by the organization administrator."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInviteModalRole(MEMBER_ROLE);
                    setIsInviteModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <FiUserPlus className="w-3.5 h-3.5" />
                  <span>Add Member</span>
                </button>
                {userRole === OWNER_ROLE && (
                  <button
                    type="button"
                    onClick={() => {
                      setInviteModalRole(MANAGER_ROLE);
                      setIsInviteModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <FiShield className="w-3.5 h-3.5" />
                    <span>Add Manager</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayMembers && displayMembers.length > 0 ? (
                    displayMembers.map((member) => {
                      const profile = member.profiles;
                      const initials =
                        profile?.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "U";

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {profile?.full_name || "Anonymous Member"}
                                </p>
                                {member.user_id === currentUserId && (
                                  <span className="text-[10px] text-blue-600 font-semibold">
                                    (You)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono">
                            {profile?.email || "—"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                roleBadgeClasses[member.role] ||
                                roleBadgeClasses.member
                              }`}
                            >
                              {member.role}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {member.joined_at
                              ? new Date(member.joined_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  }
                                )
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-slate-400 text-xs"
                      >
                        {userRole === MANAGER_ROLE
                          ? 'No active members created by you found. Click "Add Member" to invite team members.'
                          : 'No active team members found. Click "Add Member" to invite colleagues.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────── */}
        {/* TAB 2: MEMBER & MANAGER REQUESTS MANAGEMENT */}
        {/* View pending, approved, and rejected requests in a table/list */}
        {/* ───────────────────────────────────────────────────── */}
        {activeTab === "requests" && (
          <div className="p-5 space-y-4 animate-fadeIn">
            {/* Filter and Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  placeholder="Search requests by name or email..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Type Filter - Hidden for Managers as they only have member requests */}
                {userRole !== MANAGER_ROLE && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setRequestTypeFilter("all")}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        requestTypeFilter === "all"
                          ? "bg-white text-slate-900 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      All Types
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestTypeFilter(MEMBER_ROLE)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        requestTypeFilter === MEMBER_ROLE
                          ? "bg-white text-blue-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Members
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestTypeFilter(MANAGER_ROLE)}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                        requestTypeFilter === MANAGER_ROLE
                          ? "bg-white text-purple-700 shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Managers
                    </button>
                  </div>
                )}

                {/* Status Filter */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      requestStatusFilter === "all"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter("pending")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      requestStatusFilter === "pending"
                        ? "bg-white text-amber-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequestStatusFilter("accepted")}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                      requestStatusFilter === "accepted"
                        ? "bg-white text-emerald-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Accepted
                  </button>
                </div>
              </div>
            </div>

            {/* Requests Table */}
            <div className="overflow-x-auto">
              {loadingRequests ? (
                <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                  <span>Loading request records...</span>
                </div>
              ) : filteredRequests && filteredRequests.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Invited Candidate</th>
                      <th className="py-3 px-3">Email</th>
                      {userRole !== MANAGER_ROLE && <th className="py-3 px-3">Type</th>}
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Invitation Note</th>
                      <th className="py-3 px-3">Submitted</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRequests.map((req) => {
                      const isPending = req.status === "pending";
                      const isProcessing = processingRequestId === req.id;

                      return (
                        <tr
                          key={`${req.request_type}-${req.id}`}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                  req.request_type === MANAGER_ROLE
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {req.full_name?.charAt(0)?.toUpperCase() || "?"}
                              </div>
                              <span className="font-bold text-slate-900">
                                {req.full_name}
                              </span>
                            </div>
                          </td>

                          <td className="py-3 px-3 font-mono text-slate-600">
                            {req.email}
                          </td>

                          {userRole !== MANAGER_ROLE && (
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  req.request_type === MANAGER_ROLE
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                }`}
                              >
                                {req.request_type}
                              </span>
                            </td>
                          )}

                          <td className="py-3 px-3">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                statusBadgeClasses[req.status] ||
                                statusBadgeClasses.pending
                              }`}
                            >
                              {req.status}
                            </span>
                          </td>

                          <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                            {req.message ? (
                              <span title={req.message}>{req.message}</span>
                            ) : (
                              <span className="text-slate-300 italic">—</span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                            {new Date(req.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </td>

                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isProcessing ? (
                              <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                            ) : isAuthorizedAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteRequest(req)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title={isPending ? "Cancel invitation" : "Delete request record"}
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs space-y-3">
                  <FiClock className="w-8 h-8 mx-auto text-slate-300" />
                  <p>
                    {userRole === MANAGER_ROLE
                      ? "No member requests found matching your filters."
                      : "No member or manager requests found matching your filters."}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setInviteModalRole(MEMBER_ROLE);
                        setIsInviteModalOpen(true);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-sm"
                    >
                      Add Member
                    </button>
                    {userRole === OWNER_ROLE && (
                      <button
                        type="button"
                        onClick={() => {
                          setInviteModalRole(MANAGER_ROLE);
                          setIsInviteModalOpen(true);
                        }}
                        className="px-4 py-2 bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm"
                      >
                        Add Manager
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────── */}
        {/* TAB 3: ORGANIZATION PROFILE & LOCALIZATION */}
        {/* Display organization information in a card section (Owner only) */}
        {/* ───────────────────────────────────────────────────── */}
        {activeTab === "details" && userRole !== MANAGER_ROLE && (
          <div className="p-6 space-y-6 animate-fadeIn text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* General Card */}
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-200/60 pb-2">
                  <FiGlobe className="w-4 h-4 text-blue-600" />
                  <span>General Information</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Organization Name
                  </p>
                  <p className="font-semibold text-slate-800 text-sm mt-0.5">
                    {org?.name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Slug / URL Path
                  </p>
                  <p className="font-mono text-slate-700 mt-0.5">
                    {org?.slug || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Description
                  </p>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {org?.description || "No description provided."}
                  </p>
                </div>
              </div>

              {/* Company & Contact Card */}
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-200/60 pb-2">
                  <FiLayers className="w-4 h-4 text-purple-600" />
                  <span>Company & Contact</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Industry
                  </p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {org?.industry || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Company Size
                  </p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {org?.company_size || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Email
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    {org?.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Phone
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    {org?.phone || "—"}
                  </p>
                </div>
              </div>

              {/* Location & Localization Card */}
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-200/60 pb-2">
                  <FiMapPin className="w-4 h-4 text-emerald-600" />
                  <span>Location & Defaults</span>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Address
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    {[org?.address, org?.city, org?.state, org?.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Postal Code
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    {org?.postal_code || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Workspace Timezone
                  </p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {org?.timezone || "UTC"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">
                    Currency
                  </p>
                  <p className="font-semibold text-slate-800 mt-0.5">
                    {org?.currency || "USD"}
                  </p>
                </div>
              </div>
            </div>

            {/* Ownership & Metadata */}
            <div className="p-4 rounded-xl bg-slate-100/70 border border-slate-200 text-slate-500 flex flex-wrap items-center justify-between gap-3 text-[11px]">
              {userRole === OWNER_ROLE && (
                <div>
                  <span className="font-bold text-slate-700">Created By UUID: </span>
                  <span className="font-mono">{org?.created_by || "—"}</span>
                </div>
              )}
              <div>
                <span className="font-bold text-slate-700">Created Date: </span>
                <span>
                  {org?.created_at
                    ? new Date(org.created_at).toLocaleString()
                    : "—"}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Last Updated: </span>
                <span>
                  {org?.updated_at
                    ? new Date(org.updated_at).toLocaleString()
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────── */}
      {/* Unified Add Member & Manager Modal */}
      {/* ───────────────────────────────────────────────────── */}
      <AddMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        defaultRole={inviteModalRole}
        organizationId={org?.id}
        organizationName={org?.name}
        currentUserId={currentUserId}
        currentUserRole={userRole}
        onSuccess={() => {
          loadRequests();
          setActiveTab("requests");
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Member View: Leadership Presentation & Directory + Tasks
// - No organization private details or settings exposed
// - Prominently presents Workspace Owner (who created) & Reporting Manager (who created)
// - Displays Manager listing and fellow Member listing (teammates)
// - Full access to Assigned Tasks and Kanban workflow
// ─────────────────────────────────────────────────────────
function MemberTasksView({ membership, user, onRefresh }) {
  const router = useRouter();
  const org = membership?.organizations;
  const [activeTab, setActiveTab] = useState("tasks"); // 'tasks' | 'team'
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [leadership, setLeadership] = useState({ owner: null, manager: null });
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamSearch, setTeamSearch] = useState("");

  const loadMemberTasks = useCallback(async () => {
    if (!org?.id) return;
    try {
      setLoadingTasks(true);
      const data = await taskService.getTasks({
        organizationId: org.id,
        userId: user?.id,
        userRole: MEMBER_ROLE,
        userName: user?.full_name || user?.name || "",
        userEmail: user?.email || "",
      });
      setTasks(data || []);
    } catch (err) {
      console.error("loadMemberTasks error:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [org?.id, user?.id, user?.full_name, user?.name, user?.email]);

  const loadMemberTeam = useCallback(async () => {
    if (!org?.id) return;
    try {
      setLoadingTeam(true);
      const [leadData, memsData] = await Promise.all([
        organizationService.getOrganizationLeadership(org.id, {
          currentUserId: user?.id,
          currentUserRole: MEMBER_ROLE,
        }),
        organizationService.getOrganizationMembers(org.id, {
          currentUserId: user?.id,
          currentUserRole: MEMBER_ROLE,
        }),
      ]);
      setLeadership(leadData || { owner: null, manager: null });
      setTeamMembers(memsData || []);
    } catch (err) {
      console.error("loadMemberTeam error:", err);
    } finally {
      setLoadingTeam(false);
    }
  }, [org?.id, user?.id]);

  useEffect(() => {
    loadMemberTasks();
    loadMemberTeam();
  }, [loadMemberTasks, loadMemberTeam]);

  const handleUpdateStatus = async (taskId, newStatus) => {
    try {
      await taskService.updateTask(
        taskId,
        { status: newStatus },
        { userId: user?.id, userRole: MEMBER_ROLE }
      );
      toast.success(`Task moved to ${newStatus}`);
      await loadMemberTasks();
    } catch (err) {
      toast.error("Failed to update task status.");
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.title?.toLowerCase().includes(search.toLowerCase()) ||
        t.id?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const filteredTeamMembers = useMemo(() => {
    return teamMembers.filter((m) => {
      const name = m.profiles?.full_name?.toLowerCase() || "";
      const email = m.profiles?.email?.toLowerCase() || "";
      const role = m.role?.toLowerCase() || "";
      const q = teamSearch.toLowerCase().trim();
      return !q || name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [teamMembers, teamSearch]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const todo = tasks.filter((t) => t.status === "todo").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress" || t.status === "review").length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, todo, inProgress, done };
  }, [tasks]);

  const priorityStyles = {
    urgent: "bg-red-50 text-red-700 border-red-200",
    high: "bg-orange-50 text-orange-700 border-orange-200",
    medium: "bg-amber-50 text-amber-700 border-amber-200",
    low: "bg-slate-50 text-slate-700 border-slate-200",
  };

  const statusStyles = {
    todo: "bg-slate-100 text-slate-700",
    "in-progress": "bg-blue-100 text-blue-800",
    review: "bg-purple-100 text-purple-800",
    done: "bg-emerald-100 text-emerald-800",
  };

  const roleBadgeClasses = {
    owner: "bg-amber-100 text-amber-800 border-amber-200",
    manager: "bg-purple-100 text-purple-800 border-purple-200",
    member: "bg-blue-100 text-blue-800 border-blue-200",
  };

  return (
    <div className="min-h-full bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6 select-none animate-fadeIn">
      {/* ───────────────────────────────────────────────────── */}
      {/* 1. Member Header Card (No Org Settings Leaked)        */}
      {/* ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Workspace Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
              Role: Member
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Workspace: <span className="font-semibold text-slate-700">{org?.name}</span> • View your assigned tasks and team members.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <FiLayers className="w-4 h-4" />
            <span>Open Kanban Board</span>
          </button>
          <button
            type="button"
            onClick={() => {
              loadMemberTasks();
              loadMemberTeam();
              if (onRefresh) onRefresh();
              toast.info("Refreshed workspace data.");
            }}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
            title="Refresh data"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────── */}
      {/* 2. Leadership Presentation (Owner and Manager Who Created) */}
      {/* ───────────────────────────────────────────────────── */}
      {(leadership.owner || leadership.manager) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Workspace Owner Who Created */}
          {leadership.owner && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-black text-lg flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                {leadership.owner.profiles?.full_name?.charAt(0)?.toUpperCase() || "O"}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">
                    {leadership.owner.profiles?.full_name || "Workspace Owner"}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Workspace Creator
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-mono">
                  {leadership.owner.profiles?.email || "—"}
                </p>
                <p className="text-[11px] text-amber-800 font-medium">
                  Workspace Creator & Primary Organization Owner
                </p>
              </div>
            </div>
          )}

          {/* Reporting Manager Who Created / Invited You */}
          {leadership.manager && (
            <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-white border border-purple-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-purple-500/20 shrink-0">
                {leadership.manager.profiles?.full_name?.charAt(0)?.toUpperCase() || "M"}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">
                    {leadership.manager.profiles?.full_name || "Reporting Manager"}
                  </span>
                  <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full border border-purple-300">
                    Who Created You
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-mono">
                  {leadership.manager.profiles?.email || "—"}
                </p>
                <p className="text-[11px] text-purple-800 font-medium">
                  Assigned Team Manager (Created / Invited Your Account)
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────── */}
      {/* 3. Navigation Tabs: Tasks vs Team Directory           */}
      {/* ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tasks"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FiLayers className="w-4 h-4" />
            <span>My Assigned Tasks</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "team"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <FiUsers className="w-4 h-4" />
            <span>Team Directory & Managers</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {teamMembers.length}
            </span>
          </button>
        </div>

        {/* ─────────────────────────────────────────────────── */}
        {/* TAB 1: MY ASSIGNED TASKS                           */}
        {/* ─────────────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <div className="p-5 space-y-6">
            {/* Task Summary Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/60 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <FiLayers className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Assigned</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.total}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/60 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                  <FiClock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To Do</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.todo}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/60 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <FiActivity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Progress</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.inProgress}</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/60 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <FiCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completed</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">{stats.done}</p>
                </div>
              </div>
            </div>

            {/* Filters & Search */}
            <div className="bg-slate-50/60 rounded-2xl border border-slate-200/60 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, description or ID..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-700 font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">In Review</option>
                  <option value="done">Done</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none text-slate-700 font-medium"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Task Cards List */}
            <div className="space-y-3">
              {loadingTasks ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-xs text-slate-400">
                  Loading your assigned tasks...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
                  <FiLayers className="w-8 h-8 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-800">No Assigned Tasks Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You currently have no tasks assigned to you. Once your workspace manager assigns you tasks, they will appear here.
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <div
                    key={task.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-shadow space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-md">
                          {task.id}
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          Project: <span className="text-slate-800">{task.project_name || "Main Project"}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            priorityStyles[task.priority] || priorityStyles.medium
                          }`}
                        >
                          Priority: {task.priority || "medium"}
                        </span>
                        {task.due_date && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed whitespace-pre-line">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">Status:</span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                            statusStyles[task.status] || statusStyles.todo
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-slate-400 font-semibold">Move Status:</label>
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateStatus(task.id, e.target.value)}
                          className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none font-medium cursor-pointer"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="review">In Review</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────── */}
        {/* TAB 2: TEAM DIRECTORY & MANAGERS (No Org Details)   */}
        {/* ─────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div className="p-5 space-y-4 animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Workspace Leadership & Team Members
                </h3>
                <p className="text-xs text-slate-500">
                  Listing of your reporting manager, workspace creator, and teammates.
                </p>
              </div>

              <div className="relative w-full sm:w-64">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="Search team members..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Member</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTeam ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        Loading team directory...
                      </td>
                    </tr>
                  ) : filteredTeamMembers && filteredTeamMembers.length > 0 ? (
                    filteredTeamMembers.map((m) => {
                      const profile = m.profiles;
                      const initials =
                        profile?.full_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2) || "U";

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {profile?.full_name || "Team Member"}
                                </p>
                                {m.user_id === user?.id && (
                                  <span className="text-[10px] text-blue-600 font-semibold">
                                    (You)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600 font-mono">
                            {profile?.email || "—"}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                  roleBadgeClasses[m.role] || roleBadgeClasses.member
                                }`}
                              >
                                {m.role}
                              </span>
                              {m.role === OWNER_ROLE && (
                                <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                  Workspace Creator
                                </span>
                              )}
                              {m.role === MANAGER_ROLE && (
                                <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                  Who Created You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-500">
                            {m.joined_at
                              ? new Date(m.joined_at).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                        No team members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main Dashboard Page Component
// ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const [orgMemberships, setOrgMemberships] = useState([]);
  const [userInvitations, setUserInvitations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [members, setMembers] = useState([]);

  const fetchOrgs = useCallback(async () => {
    if (!user?.id) {
      setLoadingOrgs(false);
      return;
    }
    try {
      setLoadingOrgs(true);
      const [orgs, invites] = await Promise.all([
        organizationService.getUserOrganizations(user.id),
        user.email ? organizationService.getUserPendingInvitations(user.email) : Promise.resolve([]),
      ]);
      setOrgMemberships(orgs || []);
      setUserInvitations(invites || []);
    } catch (err) {
      console.error("fetchOrgs error:", err);
    } finally {
      setLoadingOrgs(false);
    }
  }, [user?.id, user?.email]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  // Fetch members of the current active organization
  const fetchMembers = useCallback(async () => {
    if (orgMemberships && orgMemberships.length > 0) {
      const orgId =
        orgMemberships[0]?.organizations?.id || orgMemberships[0]?.id;
      const userRole = orgMemberships[0]?.role || user?.role || MEMBER_ROLE;
      if (orgId) {
        try {
          const orgMembers = await organizationService.getOrganizationMembers(
            orgId,
            { currentUserId: user?.id, currentUserRole: userRole }
          );
          setMembers(orgMembers);
        } catch (err) {
          console.error("Failed to fetch members in DashboardPage:", err);
        }
      }
    }
  }, [orgMemberships, user?.id, user?.role]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

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

  // User has no organization: show prompt / Create Organization flow
  if (!orgMemberships || orgMemberships.length === 0) {
    return (
      <NoOrganizationView
        userName={user?.full_name || user?.name}
        userEmail={user?.email}
        userInvitations={userInvitations}
        onCreateOrg={handleCreateOrg}
        onLogout={handleLogout}
      />
    );
  }

  // If active user role is Member, render MemberTasksView (task details only!)
  const activeUserRole = orgMemberships[0]?.role || user?.role || MEMBER_ROLE;
  if (activeUserRole === MEMBER_ROLE) {
    return (
      <MemberTasksView
        membership={orgMemberships[0]}
        user={user}
        onRefresh={async () => {
          await fetchOrgs();
        }}
      />
    );
  }

  // User has organization(s) and is Owner or Manager: show full Organization Dashboard
  return (
    <OrganizationDashboardContent
      membership={orgMemberships[0]}
      members={members}
      currentUserId={user?.id}
      onRefresh={async () => {
        await fetchOrgs();
        await fetchMembers();
      }}
    />
  );
}