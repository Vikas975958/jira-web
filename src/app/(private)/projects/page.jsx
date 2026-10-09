"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import {
  FiPlus,
  FiCheckCircle,
  FiClock,
  FiSearch,
  FiTrash2,
  FiLayers,
} from "react-icons/fi";
import { toast } from "react-toastify";
import organizationService from "@/services/organization.service";
import taskService from "@/services/task.service";
import CreateIssueModal from "@/components/CreateIssueModal";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const COLUMNS = [
  { id: "todo", label: "To Do", bg: "bg-slate-100", border: "border-slate-200" },
  { id: "in-progress", label: "In Progress", bg: "bg-blue-50/60", border: "border-blue-200" },
  { id: "review", label: "In Review", bg: "bg-purple-50/60", border: "border-purple-200" },
  { id: "done", label: "Done", bg: "bg-emerald-50/60", border: "border-emerald-200" },
];

export default function ProjectsPage() {
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [activeOrgMembership, setActiveOrgMembership] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeOrg = activeOrgMembership?.organizations || activeOrgMembership;
  const userRole = activeOrgMembership?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;

  // Load organization
  useEffect(() => {
    const fetchOrg = async () => {
      if (!user?.id) return;
      try {
        const orgs = await organizationService.getUserOrganizations(user.id);
        if (orgs && orgs.length > 0) {
          setActiveOrgMembership(orgs[0]);
        }
      } catch (_) {}
    };
    fetchOrg();
  }, [user?.id]);

  // Load tickets using taskService with role scoping
  const loadTickets = useCallback(async () => {
    if (!activeOrg?.id) return;
    try {
      const data = await taskService.getTasks({
        organizationId: activeOrg.id,
        userId: user?.id,
        userRole,
        userName: user?.full_name || user?.name || "",
        userEmail: user?.email || "",
      });
      setTickets(data || []);
    } catch (err) {
      console.error("loadTickets error:", err);
    }
  }, [activeOrg?.id, user?.id, userRole, user?.full_name, user?.name, user?.email]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleAddTicket = async (newTicket) => {
    try {
      const created = await taskService.createTask({
        ...newTicket,
        organizationId: activeOrg?.id,
        createdBy: user?.id,
      });
      toast.success(`Created issue ${created.id}: "${created.title.slice(0, 30)}..."`);
      await loadTickets();
    } catch (err) {
      toast.error("Failed to create issue.");
    }
  };

  const moveTicket = async (ticketId, nextStatus) => {
    try {
      await taskService.updateTask(
        ticketId,
        { status: nextStatus },
        { userId: user?.id, userRole }
      );
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
      );
    } catch (_) {}
  };

  const deleteTicket = async (ticketId) => {
    if (isMember) {
      toast.error("Members are not authorized to delete tasks.");
      return;
    }
    try {
      await taskService.deleteTask(ticketId, userRole);
      toast.info(`Deleted issue ${ticketId}`);
      await loadTickets();
    } catch (err) {
      toast.error(err?.message || "Failed to delete issue.");
    }
  };

  const filteredTickets = tickets.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.id?.toLowerCase().includes(q) ||
      t.assignee?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  });

  const priorityColors = {
    urgent: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {isMember ? "My Assigned Tasks" : "Kanban Board"}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isMember
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : userRole === OWNER_ROLE
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-purple-100 text-purple-800 border-purple-200"
              }`}
            >
              Role: {userRole}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isMember
              ? `Displaying only tasks assigned to you in ${activeOrg?.name || "workspace"}`
              : `Active sprint board for ${activeOrg?.name || "your workspace"}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-48 sm:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {!isMember && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer whitespace-nowrap"
            >
              <FiPlus className="w-4 h-4" />
              <span>Create Issue</span>
            </button>
          )}
        </div>
      </div>

      {/* Zero State if no tickets */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <FiLayers className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              No Issues Created Yet
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your backlog is clean. Click the button below to create your first issue and start sprint planning.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <FiPlus className="w-4 h-4" />
            <span>Create Issue</span>
          </button>
        </div>
      ) : (
        /* Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTickets = filteredTickets.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                className={`rounded-2xl p-3 border ${col.border} ${col.bg} flex flex-col min-h-[500px]`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 px-1 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span>{col.label}</span>
                  <span className="w-5 h-5 rounded-full bg-white text-slate-600 flex items-center justify-center text-[10px] shadow-2xs font-bold">
                    {colTickets.length}
                  </span>
                </div>

                {/* Tickets in Column */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono font-bold text-blue-600">
                          {ticket.id}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => deleteTicket(ticket.id)}
                            className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                            title="Delete issue"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs font-bold text-slate-900 leading-snug">
                        {ticket.title}
                      </p>

                      {ticket.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {ticket.description}
                        </p>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded-full uppercase font-bold border ${
                            priorityColors[ticket.priority] || priorityColors.medium
                          }`}
                        >
                          {ticket.priority || "medium"}
                        </span>

                        <span className="text-slate-500 font-medium truncate max-w-[100px]">
                          {ticket.assignee || "Unassigned"}
                        </span>
                      </div>

                      {/* Quick Move Status Selector */}
                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Move:</span>
                        <select
                          value={ticket.status}
                          onChange={(e) => moveTicket(ticket.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {colTickets.length === 0 && (
                    <div className="h-24 rounded-xl border-2 border-dashed border-slate-200/80 flex items-center justify-center text-slate-400 text-xs italic">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Issue Modal */}
      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAddTicket={handleAddTicket}
        organizationName={activeOrg?.name || "Jira Workspace"}
      />
    </div>
  );
}
