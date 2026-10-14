"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { useSearchParams } from "next/navigation";
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
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { useOrganization } from "@/context/OrganizationContext";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

function TeamPageContent() {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const searchParams = useSearchParams();
  const querySearch = searchParams.get("search");

  const { currentOrg, organizations, members: contextMembers = [], refreshMembers } = useOrganization();
  const activeOrgMembership = currentOrg || (organizations && organizations[0]) || null;
  const activeOrg = activeOrgMembership?.organizations || activeOrgMembership;
  const userRole = activeOrgMembership?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;
  const orgId = activeOrg?.id;

  const [members, setMembers] = useState(contextMembers || []);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(contextMembers.length === 0);
  const [activeTab, setActiveTab] = useState("members"); // 'members' | 'requests'
  const [searchTerm, setSearchTerm] = useState(querySearch || "");

  useEffect(() => {
    if (querySearch !== null && querySearch !== undefined) {
      setSearchTerm(querySearch);
    }
  }, [querySearch]);
  const [leadership, setLeadership] = useState(() =>
    organizationService.getOrganizationLeadershipSync(contextMembers, user?.id, userRole)
  );

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteModalRole, setInviteModalRole] = useState(MEMBER_ROLE);
  const [processingId, setProcessingId] = useState(null);

  // Custom Delete Confirm Modal State
  const [deleteModalState, setDeleteModalState] = useState({
    isOpen: false,
    item: null,
    title: "",
    subtitle: "",
    message: "",
    confirmButtonText: "Delete",
    actionType: null,
  });
  const [isDeleting, setIsDeleting] = useState(false);

  // In-flight and last fetched tracking refs
  const isFetchingTeamRef = React.useRef(false);
  const lastFetchedTeamKeyRef = React.useRef(null);
  const membersRef = React.useRef(members);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Sync from contextMembers if available
  useEffect(() => {
    if (contextMembers && contextMembers.length > 0 && members.length === 0) {
      setMembers(contextMembers);
      const l = organizationService.getOrganizationLeadershipSync(contextMembers, user?.id, userRole);
      setLeadership(l);
      setLoading(false);
    }
  }, [contextMembers, members.length, user?.id, userRole]);

  const loadTeamData = useCallback(async (force = false) => {
    if (!orgId || !user?.id) {
      setLoading(false);
      return;
    }

    const fetchKey = `${orgId}:${user.id}:${userRole}`;
    if (!force && lastFetchedTeamKeyRef.current === fetchKey && membersRef.current.length > 0) {
      setLoading(false);
      return;
    }

    if (isFetchingTeamRef.current) return;

    try {
      isFetchingTeamRef.current = true;
      setLoading(true);
      const currentRole = userRole;

      // 1. Members: use contextMembers if already loaded and not forced
      let membersData =
        !force && contextMembers && contextMembers.length > 0
          ? contextMembers
          : await organizationService.getOrganizationMembers(
              orgId,
              {
                currentUserId: user.id,
                currentUserRole: currentRole,
              },
              force
            );

      // 2. Requests: only for non-members
      const requestsData =
        currentRole === MEMBER_ROLE
          ? []
          : await organizationService.getAllRequests(
              orgId,
              {
                currentUserId: user.id,
                currentUserRole: currentRole,
              },
              force
            );

      // 3. Leadership: extract directly from membersData in 0ms without redundant network queries!
      const leadershipData = organizationService.getOrganizationLeadershipSync(
        membersData,
        user.id,
        currentRole
      );

      lastFetchedTeamKeyRef.current = fetchKey;
      setMembers(membersData || []);
      setRequests(requestsData || []);
      setLeadership(leadershipData || { owner: null, manager: null });
    } catch (err) {
      console.error("loadTeamData error:", err);
    } finally {
      setLoading(false);
      isFetchingTeamRef.current = false;
    }
  }, [orgId, user?.id, userRole, contextMembers]);

  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  // Synchronize when invitations or members are modified elsewhere
  useEffect(() => {
    const handleSync = () => {
      loadTeamData(true);
      refreshMembers();
    };
    window.addEventListener("invitation-deleted", handleSync);
    window.addEventListener("member-removed", handleSync);
    window.addEventListener("project-updated", handleSync);
    return () => {
      window.removeEventListener("invitation-deleted", handleSync);
      window.removeEventListener("member-removed", handleSync);
      window.removeEventListener("project-updated", handleSync);
    };
  }, [loadTeamData, refreshMembers]);

  const handleDeleteRequest = (req) => {
    setDeleteModalState({
      isOpen: true,
      item: {
        name: req.profiles?.full_name || req.email,
        email: req.email,
        role: req.intended_role,
        raw: req,
      },
      title: req.status === "pending" ? "Cancel Invitation" : "Delete Request",
      subtitle: "This invitation will be revoked immediately.",
      message: `Are you sure you want to cancel the invitation for ${req.email}? They will no longer be able to join using this invite link.`,
      confirmButtonText: req.status === "pending" ? "Cancel Invitation" : "Delete",
      actionType: "request",
    });
  };

  const handleRemoveMember = (member) => {
    const memberName = member.profiles?.full_name || member.full_name || member.email || "this member";
    setDeleteModalState({
      isOpen: true,
      item: {
        name: memberName,
        email: member.profiles?.email || member.email,
        role: member.role,
        raw: member,
      },
      title: "Remove Team Member",
      subtitle: "Workspace and project access will be revoked.",
      message: `Are you sure you want to remove ${memberName} from this workspace? They will also be removed from all assigned projects and lose access immediately.`,
      confirmButtonText: "Remove Member",
      actionType: "member",
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalState.item?.raw) return;
    setIsDeleting(true);
    setProcessingId(deleteModalState.item.raw.id);
    try {
      if (deleteModalState.actionType === "request") {
        const req = deleteModalState.item.raw;
        await organizationService.deleteRequest({
          requestId: req.id,
          type: req.request_type,
          email: req.email,
          organizationId: orgId,
        });
        toast.success("Invitation removed.");
      } else if (deleteModalState.actionType === "member") {
        const member = deleteModalState.item.raw;
        await organizationService.removeOrganizationMember({
          organizationId: orgId,
          userId: member.user_id,
          userEmail: member.profiles?.email || member.email,
          callerRole: userRole,
          callerId: user?.id,
        });
        toast.success("Member removed successfully.");
      }
      setDeleteModalState((prev) => ({ ...prev, isOpen: false }));
      await loadTeamData(true);
      refreshMembers();
    } catch (err) {
      toast.error(err?.message || "Action failed.");
    } finally {
      setIsDeleting(false);
      setProcessingId(null);
    }
  };

  const filteredMembers = members.filter((m) => {
    const name = m.profiles?.full_name?.toLowerCase() || m.full_name?.toLowerCase() || "";
    const email = m.profiles?.email?.toLowerCase() || m.email?.toLowerCase() || "";
    const role = m.role?.toLowerCase() || "";
    const q = searchTerm.toLowerCase();
    return name.includes(q) || email.includes(q) || role.includes(q);
  });

  const filteredRequests = requests.filter((r) => {
    // Only pending requests are shown in requests list
    if (r.status !== "pending") return false;
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
    member: "bg-teal-100 text-[#0F766E] border-teal-200",
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
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {isMember ? "Team Directory" : "Team Management"}
            </h1>
            <span
              className={`px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                roleBadgeClasses[userRole] || roleBadgeClasses.member
              }`}
            >
              Role: {userRole}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {userRole === OWNER_ROLE
              ? `Displaying members and managers in ${activeOrg?.name} • Owner View`
              : userRole === MANAGER_ROLE
              ? `Displaying members created by you in ${activeOrg?.name} • Manager View`
              : `Displaying workspace leadership and teammates in ${activeOrg?.name} • Member View`}
          </p>
        </div>

        {!isMember && (
          <button
            type="button"
            onClick={() => {
              setInviteModalRole(MEMBER_ROLE);
              setIsInviteModalOpen(true);
            }}
            className="btn-primary px-3.5 py-1.5 text-xs font-semibold"
          >
            <FiUserPlus className="w-3.5 h-3.5" />
            <span>Invite Teammate</span>
          </button>
        )}
      </div>

      {/* Leadership Presentation: Manager View */}
      {userRole === MANAGER_ROLE && leadership.owner && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-[#0F766E] font-bold text-sm flex items-center justify-center shrink-0">
              {leadership.owner.profiles?.full_name?.charAt(0)?.toUpperCase() || "O"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-slate-900">
                  {leadership.owner.profiles?.full_name || "Workspace Owner"}
                </span>
                <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.2 rounded-md border border-slate-200">
                  Workspace Owner
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {leadership.owner.profiles?.email || "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Leadership Presentation: Member View */}
      {isMember && (leadership.owner || leadership.manager) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Workspace Owner */}
          {leadership.owner && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-[#0F766E] font-bold text-sm flex items-center justify-center shrink-0">
                {leadership.owner.profiles?.full_name?.charAt(0)?.toUpperCase() || "O"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {leadership.owner.profiles?.full_name || "Workspace Owner"}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-600 bg-white px-2 py-0.2 rounded-md border border-slate-200">
                    Owner
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {leadership.owner.profiles?.email || "—"}
                </p>
              </div>
            </div>
          )}

          {/* Reporting Manager */}
          {leadership.manager && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 font-bold text-sm flex items-center justify-center shrink-0">
                {leadership.manager.profiles?.full_name?.charAt(0)?.toUpperCase() || "M"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {leadership.manager.profiles?.full_name || "Reporting Manager"}
                  </span>
                  <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.2 rounded-md border border-purple-200">
                    Reporting Manager
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {leadership.manager.profiles?.email || "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-slate-200 pb-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === "members"
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Confirmed Members ({filteredMembers.length})
          </button>
          {!isMember && (
            <button
              type="button"
              onClick={() => setActiveTab("requests")}
              className={`px-3 py-1.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === "requests"
                  ? "border-[#0F766E] text-[#0F766E]"
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
            className="jira-input w-full h-8 pl-8 pr-3 text-xs"
          />
        </div>
      </div>

      {/* Content Container */}
      <div className="bg-white rounded-lg border border-slate-200/80 overflow-hidden shadow-2xs">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Loading team details...
          </div>
        ) : activeTab === "members" ? (
          /* Members Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Member</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Joined Date</th>
                  {!isMember && <th className="py-2.5 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers && filteredMembers.length > 0 ? (
                  filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {member.profiles?.full_name?.charAt(0)?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">
                              {member.profiles?.full_name || "Unknown"}
                            </span>
                            {member.user_id === user?.id && (
                              <span className="ml-1.5 text-[10px] font-semibold text-[#0F766E]">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                        {member.profiles?.email || "—"}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                            roleBadgeClasses[member.role] || roleBadgeClasses.member
                          }`}
                        >
                          {member.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {member.joined_at
                          ? new Date(member.joined_at).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      {!isMember && (
                        <td className="py-2.5 px-4 text-right">
                          {member.user_id !== user?.id && member.role !== OWNER_ROLE && (
                            userRole === OWNER_ROLE || (userRole === MANAGER_ROLE && member.role === MEMBER_ROLE)
                          ) ? (
                            processingId === member.id ? (
                              <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin" />
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(member)}
                                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                title={`Remove ${member.profiles?.full_name || member.role} from workspace`}
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          ) : (
                            <span className="text-slate-300 text-[11px]">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={!isMember ? 5 : 4} className="py-12 text-center text-slate-400">
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
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-4">Candidate</th>
                  <th className="py-2.5 px-4">Email</th>
                  {userRole !== MANAGER_ROLE && <th className="py-2.5 px-4">Type</th>}
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Note</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests && filteredRequests.length > 0 ? (
                  filteredRequests.map((req) => (
                    <tr key={`${req.request_type}-${req.id}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {req.full_name}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600">
                        {req.email}
                      </td>
                      {userRole !== MANAGER_ROLE && (
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                              req.request_type === MANAGER_ROLE
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-teal-50 text-[#0F766E] border-teal-200"
                            }`}
                          >
                            {req.request_type}
                          </span>
                        </td>
                      )}
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${
                            statusBadgeClasses[req.status] || statusBadgeClasses.pending
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate text-[11px]">
                        {req.message || <span className="text-slate-300 italic">—</span>}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {processingId === req.id ? (
                          <div className="inline-block w-4 h-4 border-2 border-slate-300 border-t-[#0F766E] rounded-full animate-spin" />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(req)}
                            className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
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
        onSuccess={() => {
          loadTeamData(true);
          refreshMembers();
        }}
      />

      {/* Delete / Remove Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title={deleteModalState.title}
        subtitle={deleteModalState.subtitle}
        message={deleteModalState.message}
        confirmButtonText={deleteModalState.confirmButtonText}
        item={deleteModalState.item}
      />
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs font-semibold text-slate-400">
          Loading team workspace...
        </div>
      }
    >
      <TeamPageContent />
    </Suspense>
  );
}
