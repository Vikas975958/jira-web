"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSelector } from "react-redux";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FiPlus,
  FiSearch,
  FiTrash2,
  FiLayers,
  FiFolder,
  FiCalendar,
  FiUsers,
  FiInfo,
  FiCheckCircle,
  FiClock,
  FiFilter,
} from "react-icons/fi";
import { toast } from "react-toastify";
import organizationService from "@/services/organization.service";
import projectService from "@/services/project.service";
import taskService from "@/services/task.service";
import CreateIssueModal from "@/components/CreateIssueModal";
import CreateProjectModal from "@/components/CreateProjectModal";
import ProjectDetailsModal from "@/components/ProjectDetailsModal";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const COLUMNS = [
  { id: "todo", label: "To Do", bg: "bg-slate-100", border: "border-slate-200" },
  { id: "in-progress", label: "In Progress", bg: "bg-blue-50/60", border: "border-blue-200" },
  { id: "review", label: "In Review", bg: "bg-purple-50/60", border: "border-purple-200" },
  { id: "done", label: "Done", bg: "bg-emerald-50/60", border: "border-emerald-200" },
];

function ProjectsBoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [activeOrgMembership, setActiveOrgMembership] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(queryProjectId || "all");
  const [tickets, setTickets] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [search, setSearch] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [projectDetailsModalData, setProjectDetailsModalData] = useState(null);

  const activeOrg = activeOrgMembership?.organizations || activeOrgMembership;
  const userRole = activeOrgMembership?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;
  const isOwner = userRole === OWNER_ROLE;
  const isManager = userRole === MANAGER_ROLE;

  // Sync URL query param to state if changed
  useEffect(() => {
    if (queryProjectId) {
      setSelectedProjectId(queryProjectId);
    }
  }, [queryProjectId]);

  // Load organization membership
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

  // Load projects list
  const loadProjects = useCallback(async () => {
    if (!activeOrg?.id) return;
    try {
      const data = await projectService.getProjects({
        organizationId: activeOrg.id,
        userId: user?.id,
        userRole,
      });
      setProjects(data || []);
    } catch (err) {
      console.error("loadProjects error:", err);
    }
  }, [activeOrg?.id, user?.id, userRole]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load tickets with role scoping
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

  // Load team members for assignments
  useEffect(() => {
    const fetchMembers = async () => {
      if (!activeOrg?.id) return;
      try {
        const members = await organizationService.getOrganizationMembers(activeOrg.id, {
          currentUserId: user?.id,
          currentUserRole: userRole,
        });
        setTeamMembers(members || []);
      } catch (err) {
        console.error("Failed to fetch team members", err);
      }
    };
    fetchMembers();
  }, [activeOrg?.id, user?.id, userRole]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  const handleAddTicket = async (newTicket) => {
    try {
      const created = await taskService.createTask({
        ...newTicket,
        organizationId: activeOrg?.id,
        projectId: newTicket.projectId || selectedProject?.id || null,
        project_name: newTicket.projectName || selectedProject?.name || null,
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

  const handleDragStart = (e, ticketId) => {
    e.dataTransfer.setData("ticketId", ticketId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, statusId) => {
    e.preventDefault();
    const ticketId = e.dataTransfer.getData("ticketId");
    if (ticketId) {
      moveTicket(ticketId, statusId);
    }
  };

  // Filter tickets by project and search query
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Project filter
      if (selectedProjectId && selectedProjectId !== "all") {
        const matchesProject =
          t.project_id === selectedProjectId ||
          t.projectId === selectedProjectId ||
          (selectedProject && t.project_name === selectedProject.name);
        if (!matchesProject) return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.assignee?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [tickets, selectedProjectId, selectedProject, search]);

  const priorityColors = {
    urgent: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* ─────────────────────────────────────────────────── */}
      {/* Page Header                                        */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {isMember ? "My Assigned Tasks" : "Project Board"}
            </h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isMember
                  ? "bg-blue-100 text-blue-800 border-blue-200"
                  : isOwner
                  ? "bg-amber-100 text-amber-800 border-amber-200"
                  : "bg-purple-100 text-purple-800 border-purple-200"
              }`}
            >
              Role: {userRole}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isMember
              ? `Displaying assigned tasks for ${activeOrg?.name || "workspace"}`
              : `Interactive Kanban board for ${activeOrg?.name || "your workspace"}`}
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:w-56">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues..."
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Create Project Button (Owner & Manager) */}
          {(isOwner || isManager) && (
            <button
              type="button"
              onClick={() => setIsCreateProjectModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <FiFolder className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          )}

          {/* Create Issue Button */}
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

      {/* ─────────────────────────────────────────────────── */}
      {/* Project Switcher Bar & Filter                       */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FiFilter className="w-3.5 h-3.5 text-slate-400" />
            Project:
          </span>

          <button
            type="button"
            onClick={() => {
              setSelectedProjectId("all");
              router.replace("/projects");
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedProjectId === "all"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Projects ({projects.length})
          </button>

          {projects.map((proj) => (
            <button
              key={proj.id}
              type="button"
              onClick={() => {
                setSelectedProjectId(proj.id);
                router.replace(`/projects?projectId=${proj.id}`);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedProjectId === proj.id
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FiFolder className="w-3.5 h-3.5" />
              <span>{proj.name}</span>
            </button>
          ))}
        </div>

        {selectedProject && (
          <button
            type="button"
            onClick={() => setProjectDetailsModalData(selectedProject)}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer shrink-0"
          >
            <FiInfo className="w-3.5 h-3.5" />
            <span>Project Details & Team</span>
          </button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* Selected Project Highlight Banner                   */}
      {/* ─────────────────────────────────────────────────── */}
      {selectedProject && (
        <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white border border-blue-200/80 rounded-2xl p-4.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-black text-slate-900">{selectedProject.name}</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedProject.status === "completed"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : selectedProject.status === "in_progress"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-slate-200 text-slate-700 border border-slate-300"
                }`}
              >
                {selectedProject.status?.replace("_", " ") || "active"}
              </span>
            </div>
            {selectedProject.description && (
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                {selectedProject.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0 flex-wrap">
            {(selectedProject.start_date || selectedProject.due_date) && (
              <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                <FiCalendar className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {selectedProject.start_date ? new Date(selectedProject.start_date).toLocaleDateString() : "—"}
                  {" → "}
                  {selectedProject.due_date ? new Date(selectedProject.due_date).toLocaleDateString() : "No deadline"}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setProjectDetailsModalData(selectedProject)}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              View Team ({selectedProject.project_members?.length || 0})
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* Zero State if no tickets                           */}
      {/* ─────────────────────────────────────────────────── */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <FiLayers className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {selectedProject ? `No Issues in ${selectedProject.name}` : "No Issues Created Yet"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your backlog is clear. Click the button below to create your first issue and start sprint planning.
            </p>
          </div>
          {!isMember && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <FiPlus className="w-4 h-4" />
              <span>Create Issue</span>
            </button>
          )}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────── */
        /* Kanban Board Columns                                */
        /* ─────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTickets = filteredTickets.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`rounded-2xl p-3 border ${col.border} ${col.bg} flex flex-col min-h-[500px] transition-colors`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 px-1 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <span>{col.label}</span>
                  <span className="w-5 h-5 rounded-full bg-white text-slate-600 flex items-center justify-center text-[10px] shadow-2xs font-bold">
                    {colTickets.length}
                  </span>
                </div>

                {/* Tickets in Column */}
                <div className="space-y-2.5 flex-1 overflow-y-auto min-h-[100px]">
                  {colTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-grab active:cursor-grabbing"
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

      {/* ─────────────────────────────────────────────────── */}
      {/* Create Issue Modal                                  */}
      {/* ─────────────────────────────────────────────────── */}
      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAddTicket={handleAddTicket}
        organizationName={activeOrg?.name || "Jira Workspace"}
        teamMembers={teamMembers}
        projects={projects}
        selectedProjectId={selectedProject?.id || ""}
      />

      {/* ─────────────────────────────────────────────────── */}
      {/* Create Project Modal                                */}
      {/* ─────────────────────────────────────────────────── */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        organizationId={activeOrg?.id}
        currentUserRole={userRole}
        currentUserId={user?.id}
        onProjectCreated={() => {
          loadProjects();
          toast.success("Project created successfully!");
        }}
      />

      {/* ─────────────────────────────────────────────────── */}
      {/* Project Details Modal                               */}
      {/* ─────────────────────────────────────────────────── */}
      <ProjectDetailsModal
        isOpen={!!projectDetailsModalData}
        onClose={() => setProjectDetailsModalData(null)}
        project={projectDetailsModalData}
        organizationId={activeOrg?.id}
        currentUserRole={userRole}
        currentUserId={user?.id}
        onProjectUpdated={() => {
          loadProjects();
        }}
        onProjectDeleted={() => {
          setProjectDetailsModalData(null);
          setSelectedProjectId("all");
          loadProjects();
        }}
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs font-semibold text-slate-400">
          Loading workspace projects...
        </div>
      }
    >
      <ProjectsBoardContent />
    </Suspense>
  );
}
