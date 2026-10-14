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
import { useOrganization } from "@/context/OrganizationContext";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const COLUMNS = [
  { id: "todo", label: "To Do", bg: "bg-slate-100", border: "border-slate-200" },
  { id: "in-progress", label: "In Progress", bg: "bg-teal-50/60", border: "border-teal-200" },
  { id: "review", label: "In Review", bg: "bg-purple-50/60", border: "border-purple-200" },
  { id: "done", label: "Done", bg: "bg-emerald-50/60", border: "border-emerald-200" },
];

function ProjectsBoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, members = [] } = useOrganization();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(queryProjectId || "all");
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [projectDetailsModalData, setProjectDetailsModalData] = useState(null);

  const activeOrg = currentOrg?.organizations || currentOrg || organizations?.[0]?.organizations || organizations?.[0];
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;
  const isOwner = userRole === OWNER_ROLE;
  const isManager = userRole === MANAGER_ROLE;

  // Sync URL query param to state if changed
  useEffect(() => {
    if (queryProjectId) {
      setSelectedProjectId(queryProjectId);
    }
  }, [queryProjectId]);

  // Projects ref tracking & loading
  const isFetchingProjectsRef = React.useRef(false);
  const lastFetchedProjectsKeyRef = React.useRef(null);
  const projectsRef = React.useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const loadProjects = useCallback(async (force = false) => {
    const orgId = activeOrg?.id;
    if (!orgId) return;
    const fetchKey = `${orgId}:${user?.id || ""}:${userRole}`;
    if (!force && lastFetchedProjectsKeyRef.current === fetchKey && projectsRef.current.length > 0) {
      return;
    }
    if (isFetchingProjectsRef.current) return;
    try {
      isFetchingProjectsRef.current = true;
      const data = await projectService.getProjects({
        organizationId: orgId,
        userId: user?.id,
        userRole,
        force,
      });
      lastFetchedProjectsKeyRef.current = fetchKey;
      setProjects(data || []);
    } catch (err) {
      console.error("loadProjects error:", err);
    } finally {
      isFetchingProjectsRef.current = false;
    }
  }, [activeOrg?.id, user?.id, userRole]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Tickets ref tracking & loading
  const isFetchingTicketsRef = React.useRef(false);
  const lastFetchedTicketsKeyRef = React.useRef(null);
  const ticketsRef = React.useRef(tickets);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  const loadTickets = useCallback(async (force = false) => {
    const orgId = activeOrg?.id;
    if (!orgId) return;
    const fetchKey = `${orgId}:${user?.id || ""}:${userRole}`;
    if (!force && lastFetchedTicketsKeyRef.current === fetchKey && ticketsRef.current.length > 0) {
      return;
    }
    if (isFetchingTicketsRef.current) return;
    try {
      isFetchingTicketsRef.current = true;
      const data = await taskService.getTasks({
        organizationId: orgId,
        userId: user?.id,
        userRole,
        userName: user?.full_name || user?.name || "",
        userEmail: user?.email || "",
        force,
      });
      lastFetchedTicketsKeyRef.current = fetchKey;
      setTickets(data || []);
    } catch (err) {
      console.error("loadTickets error:", err);
    } finally {
      isFetchingTicketsRef.current = false;
    }
  }, [activeOrg?.id, user?.id, userRole, user?.full_name, user?.name, user?.email]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

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
        created_by: user?.id,
        assigneeId: newTicket.assigneeId || newTicket.assignee_id || null,
        assignee_id: newTicket.assigneeId || newTicket.assignee_id || null,
      });
      await loadTickets(true);
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
      await loadTickets(true);
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
              className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                isMember
                  ? "bg-teal-100 text-[#0F766E] border-teal-200"
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
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-[#0F766E]"
            />
          </div>

          {/* Create Project Button (Owner & Manager) */}
          {(isOwner || isManager) && (
            <button
              type="button"
              onClick={() => setIsCreateProjectModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <FiFolder className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          )}

          {/* Create Issue Button */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer whitespace-nowrap"
          >
            <FiPlus className="w-4 h-4" />
            <span>Create Issue</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* Project Switcher Bar & Filter                       */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              selectedProjectId === "all"
                ? "bg-[#0F766E] text-white shadow-xs"
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedProjectId === proj.id
                  ? "bg-[#0F766E] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <FiFolder className="w-3.5 h-3.5" />
              <span>{proj.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* Selected Project Highlight Banner                   */}
      {/* ─────────────────────────────────────────────────── */}
      {selectedProject && (
        <div className="bg-gradient-to-r from-teal-50/70 via-emerald-50/30 to-white border border-teal-200/80 rounded-lg p-4.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-black text-slate-900">{selectedProject.name}</h2>
              <span
                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                  selectedProject.status === "completed"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : selectedProject.status === "in_progress"
                    ? "bg-teal-100 text-[#0F766E] border border-teal-200"
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

          <div className="flex items-center gap-3 text-xs shrink-0 flex-wrap">
            {(selectedProject.start_date || selectedProject.due_date) && (
              <div className="flex items-center gap-2 text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200">
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
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <FiInfo className="w-3.5 h-3.5 text-slate-400" />
              <span>Project Details & Team</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* Zero State                                          */}
      {/* ─────────────────────────────────────────────────── */}
      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-lg bg-teal-50 text-[#0F766E] flex items-center justify-center mx-auto">
            {projects.length === 0 ? <FiFolder className="w-8 h-8" /> : <FiLayers className="w-8 h-8" />}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {projects.length === 0
                ? "No Projects Created Yet"
                : selectedProject
                ? `No Issues in ${selectedProject.name}`
                : "No Issues Created Yet"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {projects.length === 0
                ? "Create your first project to start organizing issues and tracking agile sprints."
                : "Your backlog is clear. Click the button below to create your first issue and start sprint planning."}
            </p>
          </div>
          {projects.length === 0 ? (
            (isOwner || isManager) && (
              <button
                type="button"
                onClick={() => setIsCreateProjectModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
              >
                <FiFolder className="w-4 h-4" />
                <span>Create Project</span>
              </button>
            )
          ) : (
            !isMember && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
              >
                <FiPlus className="w-4 h-4" />
                <span>Create Issue</span>
              </button>
            )
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
                className={`rounded-lg p-3 border ${col.border} ${col.bg} flex flex-col min-h-[500px] transition-colors`}
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
                      className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs space-y-2 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono font-bold text-[#0F766E]">
                          {ticket.id}
                        </span>
                        {!isMember && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => deleteTicket(ticket.id)}
                              className="text-slate-400 hover:text-red-600 p-0.5 rounded-lg cursor-pointer"
                              title="Delete issue"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
                          className={`px-2 py-0.5 rounded-lg uppercase font-bold border ${
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
                          className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-700 outline-none"
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
                    <div className="h-24 rounded-lg border-2 border-dashed border-slate-200/80 flex items-center justify-center text-slate-400 text-xs italic">
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
        organizationName={activeOrg?.name || "WorkGrid Workspace"}
        teamMembers={members}
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
        organizationName={activeOrg?.name}
        currentUserRole={userRole}
        currentUserId={user?.id}
        existingMembers={members || []}
        onProjectCreated={() => {
          loadProjects(true);
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
          loadProjects(true);
        }}
        onProjectDeleted={() => {
          setProjectDetailsModalData(null);
          setSelectedProjectId("all");
          loadProjects(true);
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
