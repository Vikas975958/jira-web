"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  FiUsers,
  FiUserPlus,
  FiShield,
  FiClock,
  FiMail,
  FiCheck,
  FiX,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import organizationService from "@/services/organization.service";
import AddMemberModal from "@/components/AddMemberModal";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function TeamPage() {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [activeOrgMembership, setActiveOrgMembership] = useState(null);
  const activeOrg = activeOrgMembership?.organizations || activeOrgMembership;
  const userRole = activeOrgMembership?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;
  const orgId = activeOrg?.id;

  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("members"); // 'members' | 'requests'
  const [searchTerm, setSearchTerm] = useState("");
  const [leadership, setLeadership] = useState({ owner: null, manager: null });

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalRole, setInviteModalRole] = useState(MEMBER_ROLE);
  const [processingId, setProcessingId] = useState(null);

  const loadTeamData = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const orgs = await organizationService.getUserOrganizations(user.id);
      if (orgs && orgs.length > 0) {
        const membership = orgs[0];
        setActiveOrgMembership(membership);
        const orgData = membership?.organizations || membership;
        const currentRole = membership?.role || user?.role || MEMBER_ROLE;

        const [membersData, requestsData, leadershipData] = await Promise.all([
          organizationService.getOrganizationMembers(orgData.id, {
            currentUserId: user.id,
            currentUserRole: currentRole,
          }),
          currentRole === MEMBER_ROLE
            ? Promise.resolve([])
            : organizationService.getAllRequests(orgData.id, {
                currentUserId: user.id,
                currentUserRole: currentRole,
              }),
          organizationService.getOrganizationLeadership(orgData.id, {
            currentUserId: user.id,
            currentUserRole: currentRole,
          }),
        ]);
        setMembers(membersData || []);
        setRequests(requestsData || []);
        setLeadership(leadershipData || { owner: null, manager: null });
      } else {
        setActiveOrgMembership(null);
        setMembers([]);
        setRequests([]);
        setLeadership({ owner: null, manager: null });
      }
    } catch (err) {
      console.error("loadTeamData error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  const handleDeleteRequest = async (req) => {
    if (!confirm("Are you sure you want to delete this invitation?")) return;
    setProcessingId(req.id);
    try {
      await organizationService.deleteRequest({
        requestId: req.id,
        type: req.request_type,
      });
      toast.success("Invitation removed.");
      await loadTeamData();
    } catch (err) {
      toast.error(err?.message || "Failed to delete invitation.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    // Managers see listing of members only who they created themselves
    if (userRole === MANAGER_ROLE && m.role !== MEMBER_ROLE) return false;
    const name = m.profiles?.full_name?.toLowerCase() || "";
    const email = m.profiles?.email?.toLowerCase() || "";
    const role = m.role?.toLowerCase() || "";
    const q = searchTerm.toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  const filteredRequests = requests.filter((r) => {
    // Managers and members should never see manager requests or listings
    if (userRole === MANAGER_ROLE && r.request_type === MANAGER_ROLE) return false;
    const name = r.full_name?.toLowerCase() || "";
    const email = r.email?.toLowerCase() || "";
    const q = searchTerm.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  const roleBadgeClasses = {
    owner: "bg-amber-100 text-amber-800 border-amber-200",
    manager: "bg-purple-100 text-purple-800 border-purple-200",
    member: "bg-blue-100 text-blue-800 border-blue-200",
  };

  const statusBadgeClasses = {
    pending: "bg-amber-100 text-amber-800 border-amber-200",
    accepted: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };

  if (!orgId) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        Please create or select an organization to view your team.
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-6xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {isMember ? "Team Directory" : "Team Management"}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                roleBadgeClasses[userRole] || roleBadgeClasses.member
              }`}
            >
              Role: {userRole}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {userRole === OWNER_ROLE
              ? `Displaying members and managers in ${activeOrg?.name} • Owner View`
              : userRole === MANAGER_ROLE
              ? `Displaying members created by you in ${activeOrg?.name} • Manager View`
              : `Displaying workspace leadership and teammates in ${activeOrg?.name} • Member View`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!isMember && (
            <button
              type="button"
              onClick={() => {
                setInviteModalRole(MEMBER_ROLE);
                setIsInviteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <FiUserPlus className="w-4 h-4" />
              <span>Add Member</span>
            </button>
          )}
          {userRole === OWNER_ROLE && (
            <button
              type="button"
              onClick={() => {
                setInviteModalRole(MANAGER_ROLE);
                setIsInviteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <FiShield className="w-4 h-4" />
              <span>Add Manager</span>
            </button>
          )}
        </div>
      </div>

      {/* Leadership Presentation: Manager View (Present Owner, who created) */}
      {userRole === MANAGER_ROLE && leadership.owner && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
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
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/60 w-fit">
            <FiShield className="w-3.5 h-3.5 text-amber-600" />
            <span>Workspace Created & Owned By This Administrator</span>
          </div>
        </div>
      )}

      {/* Leadership Presentation: Member View (Present Owner and Manager who created) */}
      {isMember && (leadership.owner || leadership.manager) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Workspace Owner Who Created */}
          {leadership.owner && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white border border-amber-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white font-black text-base flex items-center justify-center shadow-sm shrink-0">
                {leadership.owner.profiles?.full_name?.charAt(0)?.toUpperCase() || "O"}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    {leadership.owner.profiles?.full_name || "Workspace Owner"}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                    Workspace Creator
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-mono">
                  {leadership.owner.profiles?.email || "—"}
                </p>
              </div>
            </div>
          )}

          {/* Manager Who Created You */}
          {leadership.manager && (
            <div className="bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-white border border-purple-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white font-black text-base flex items-center justify-center shadow-sm shrink-0">
                {leadership.manager.profiles?.full_name?.charAt(0)?.toUpperCase() || "M"}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    {leadership.manager.profiles?.full_name || "Reporting Manager"}
                  </span>
                  <span className="text-[10px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200">
                    Who Created You
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-mono">
                  {leadership.manager.profiles?.email || "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "members"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Confirmed Members ({filteredMembers.length})
          </button>
          {!isMember && (
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "requests"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {userRole === MANAGER_ROLE ? "Member Requests" : "Requests & Invitations"} ({filteredRequests.length})
            </button>
          )}
        </div>

        <div className="relative max-w-xs w-full">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email or role..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* Content Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Loading team details...
          </div>
        ) : activeTab === "members" ? (
          /* Members Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers && filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                            {member.profiles?.full_name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">
                              {member.profiles?.full_name || "Unknown"}
                            </span>
                            {member.user_id === user?.id && (
                              <span className="ml-1.5 text-[10px] font-semibold text-blue-600">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {member.profiles?.email || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              roleBadgeClasses[member.role] || roleBadgeClasses.member
                            }`}
                          >
                            {member.role}
                          </span>
                          {member.role === OWNER_ROLE && (
                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Workspace Creator
                            </span>
                          )}
                          {isMember && member.role === MANAGER_ROLE && (
                            <span className="text-[10px] font-semibold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                              Who Created You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {member.joined_at
                          ? new Date(member.joined_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400">
                      {isMember
                        ? "No team members found."
                        : userRole === MANAGER_ROLE
                        ? 'No members created by you found. Click "Add Member" to invite colleagues.'
                        : 'No members found. Use "Add Member" to send invitations.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Requests Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Email</th>
                  {userRole !== MANAGER_ROLE && <th className="py-3 px-4">Type</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Note</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests && filteredRequests.length > 0 ? (
                  filteredRequests.map((req) => (
                    <tr key={`${req.request_type}-${req.id}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {req.full_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {req.email}
                      </td>
                      {userRole !== MANAGER_ROLE && (
                        <td className="py-3 px-4">
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
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            statusBadgeClasses[req.status] || statusBadgeClasses.pending
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {req.message || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {processingId === req.id ? (
                          <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title={req.status === "pending" ? "Cancel invitation" : "Delete record"}
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Unified Add Member & Manager Modal */}
      <AddMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        defaultRole={inviteModalRole}
        organizationId={orgId}
        organizationName={activeOrg?.name}
        currentUserId={user?.id}
        currentUserRole={userRole}
        onSuccess={loadTeamData}
      />
    </div>
  );
}
