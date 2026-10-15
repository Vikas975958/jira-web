"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSelector } from "react-redux";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FiPlus,
  FiSearch,
  FiX,
  FiTrash2,
  FiLayers,
  FiFolder,
  FiCalendar,
  FiUsers,
  FiInfo,
  FiCheckCircle,
  FiClock,
} from "react-icons/fi";
import { toast } from "react-toastify";
import organizationService from "@/services/organization.service";
import projectService from "@/services/project.service";
import taskService from "@/services/task.service";
import CreateIssueModal from "@/components/CreateIssueModal";
import CreateProjectModal from "@/components/CreateProjectModal";
import ProjectDetailsModal from "@/components/ProjectDetailsModal";
import DeleteTaskConfirmModal from "@/components/DeleteTaskConfirmModal";
import { useOrganization } from "@/context/OrganizationContext";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { formatTaskKey } from "@/utils/commonFunction";

const COLUMNS = [
  { id: "backlog", label: "Backlog", bg: "bg-slate-100/70", border: "border-slate-200" },
  { id: "todo", label: "To Do", bg: "bg-slate-100", border: "border-slate-200" },
  { id: "in-progress", label: "In Progress", bg: "bg-teal-50/60", border: "border-teal-200" },
  { id: "review", label: "In Review", bg: "bg-purple-50/60", border: "border-purple-200" },
  { id: "done", label: "Done", bg: "bg-emerald-50/60", border: "border-emerald-200" },
];

function ProjectsBoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");
  const querySearch = searchParams.get("search");

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, members = [], loadingOrgs } = useOrganization();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(queryProjectId || "");
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState(querySearch || "");
  const [selectedMemberFilter, setSelectedMemberFilter] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [projectDetailsModalData, setProjectDetailsModalData] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);

  const activeOrg = currentOrg?.organizations || currentOrg || organizations?.[0]?.organizations || organizations?.[0];
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;
  const isOwner = userRole === OWNER_ROLE;
  const isManager = userRole === MANAGER_ROLE;

  // Sync URL query param to state if changed, or select first project by default
  useEffect(() => {
    if (queryProjectId) {
      setSelectedProjectId(queryProjectId);
    } else if (projects.length > 0) {
      setSelectedProjectId((prev) => {
        if (!prev || (prev !== "all" && !projects.some((p) => p.id === prev))) {
          return projects[0].id;
        }
        return prev;
      });
    }
  }, [queryProjectId, projects]);

  // Sync search URL query param if present
  useEffect(() => {
    if (querySearch !== null && querySearch !== undefined) {
      setSearch(querySearch);
    }
  }, [querySearch]);

  // Reset member filter when switching projects
  useEffect(() => {
    setSelectedMemberFilter(null);
  }, [selectedProjectId]);

  // Projects ref tracking & loading
  const isFetchingProjectsRef = React.useRef(false);
  const lastFetchedProjectsKeyRef = React.useRef(null);
  const projectsRef = React.useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const loadProjects = useCallback(async (force = false) => {
    const orgId = activeOrg?.id;
    if (!orgId) {
      if (!loadingOrgs) {
        setLoadingProjects(false);
      }
      return;
    }
    const fetchKey = `${orgId}:${user?.id || ""}:${userRole}`;
    if (!force && lastFetchedProjectsKeyRef.current === fetchKey && projectsRef.current.length > 0) {
      setLoadingProjects(false);
      return;
    }
    if (isFetchingProjectsRef.current) return;
    try {
      isFetchingProjectsRef.current = true;
      setLoadingProjects(true);
      const data = await projectService.getProjects({
        organizationId: orgId,
        userId: user?.id,
        userRole,
        force,
      });
      lastFetchedProjectsKeyRef.current = fetchKey;
      const fetchedProjects = data || [];
      setProjects(fetchedProjects);
      if (fetchedProjects.length > 0) {
        setSelectedProjectId((prev) => {
          if (!prev || (prev !== "all" && !fetchedProjects.some((p) => p.id === prev))) {
            return queryProjectId && (queryProjectId === "all" || fetchedProjects.some((p) => p.id === queryProjectId))
              ? queryProjectId
              : fetchedProjects[0].id;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("loadProjects error:", err);
    } finally {
      isFetchingProjectsRef.current = false;
      setLoadingProjects(false);
    }
  }, [activeOrg?.id, user?.id, userRole, queryProjectId, loadingOrgs]);

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
    if (!orgId) {
      if (!loadingOrgs) {
        setLoadingTickets(false);
      }
      return;
    }
    const fetchKey = `${orgId}:${user?.id || ""}:${userRole}`;
    if (!force && lastFetchedTicketsKeyRef.current === fetchKey && ticketsRef.current.length > 0) {
      setLoadingTickets(false);
      return;
    }
    if (isFetchingTicketsRef.current) return;
    try {
      isFetchingTicketsRef.current = true;
      setLoadingTickets(true);
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
      setLoadingTickets(false);
    }
  }, [activeOrg?.id, user?.id, userRole, user?.full_name, user?.name, user?.email, loadingOrgs]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (!loadingOrgs && !activeOrg?.id) {
      setLoadingProjects(false);
      setLoadingTickets(false);
    }
  }, [loadingOrgs, activeOrg?.id]);

  const isPageLoading =
    loadingOrgs || loadingProjects || (loadingTickets && tickets.length === 0 && projects.length === 0);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "all") return null;
    return projects.find((p) => p.id === selectedProjectId) || null;
  }, [projects, selectedProjectId]);

  // Project team members list for avatar filters
  const projectTeamList = useMemo(() => {
    if (!selectedProject) return [];

    const map = new Map();

    // 1. Members assigned to this project
    (selectedProject.project_members || []).forEach((pm) => {
      const uId = pm.user_id || pm.id;
      const name = pm.profiles?.full_name || pm.name || pm.fullName || "";
      const email = pm.profiles?.email || pm.email || "";
      const displayName = name || email?.split("@")[0] || "User";
      const initial = displayName.charAt(0).toUpperCase();
      map.set(uId || email || displayName, {
        id: uId,
        name: displayName,
        email,
        initial,
      });
    });

    // 2. Also check organization members assigned to this project
    if (Array.isArray(members)) {
      members.forEach((m) => {
        const uId = m.user_id || m.profiles?.id || m.id;
        const isAssigned = (selectedProject.project_members || []).some(
          (pm) => (pm.user_id || pm.id) === uId
        );
        if (isAssigned && uId && !map.has(uId)) {
          const name = m.full_name || m.name || m.profiles?.full_name || "";
          const email = m.email || m.profiles?.email || "";
          const displayName = name || email?.split("@")[0] || "User";
          map.set(uId, {
            id: uId,
            name: displayName,
            email,
            initial: displayName.charAt(0).toUpperCase(),
          });
        }
      });
    }

    // 3. Also include assignees from the project's tickets
    tickets.forEach((t) => {
      const matchesProj =
        t.project_id === selectedProject.id ||
        t.projectId === selectedProject.id ||
        t.project_name === selectedProject.name;
      if (matchesProj && t.assignee && t.assignee.toLowerCase() !== "unassigned") {
        const key = t.assignee_id || t.assignee;
        if (!map.has(key)) {
          map.set(key, {
            id: t.assignee_id || null,
            name: t.assignee,
            email: "",
            initial: t.assignee.charAt(0).toUpperCase(),
          });
        }
      }
    });

    // 4. Fallback: If no assigned project members found yet, show organization members
    if (map.size === 0 && Array.isArray(members)) {
      members.forEach((m) => {
        const uId = m.user_id || m.profiles?.id || m.id;
        const name = m.full_name || m.name || m.profiles?.full_name || "";
        const email = m.email || m.profiles?.email || "";
        const displayName = name || email?.split("@")[0] || "Member";
        if (uId || name || email) {
          map.set(uId || email || displayName, {
            id: uId,
            name: displayName,
            email,
            initial: displayName.charAt(0).toUpperCase(),
          });
        }
      });
    }

    return Array.from(map.values());
  }, [selectedProject, members, tickets]);

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

  const handleDeleteTicketClick = (ticket) => {
    if (isMember) {
      toast.error("Members are not authorized to delete tasks.");
      return;
    }
    setDeletingTicket(ticket);
  };

  const handleConfirmDeleteTicket = async () => {
    if (!deletingTicket) return;
    if (isMember) {
      toast.error("Members are not authorized to delete tasks.");
      setDeletingTicket(null);
      return;
    }
    try {
      setIsDeletingTicket(true);
      await taskService.deleteTask(deletingTicket.id, userRole);
      setDeletingTicket(null);
      await loadTickets(true);
    } catch (err) {
      toast.error(err?.message || "Failed to delete issue.");
    } finally {
      setIsDeletingTicket(false);
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

      // Team member assignee filter
      if (selectedMemberFilter) {
        const target = selectedMemberFilter.toLowerCase();
        const matchesAssignee =
          (t.assignee_id && t.assignee_id === selectedMemberFilter) ||
          (t.assignee && t.assignee.toLowerCase() === target) ||
          (t.assignee && t.assignee.toLowerCase().includes(target));
        if (!matchesAssignee) return false;
      }

      // Search filter
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const displayKey = formatTaskKey(t, projects, selectedProject?.name).toLowerCase();
      return (
        displayKey.includes(q) ||
        t.title?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.assignee?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [tickets, selectedProjectId, selectedProject, selectedMemberFilter, search, projects]);

  const priorityColors = {
    urgent: "bg-red-100 text-red-700 border-red-200",
    high: "bg-orange-100 text-orange-700 border-orange-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-5 max-w-[1680px] mx-auto select-none">
      {/* ─────────────────────────────────────────────────── */}
      {/* Page Header                                        */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {selectedProject ? selectedProject.name : (isMember ? "My Assigned Tasks" : "Project Board")}
            </h1>
            {selectedProject && (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                  selectedProject.status === "completed"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                    : selectedProject.status === "in_progress"
                    ? "bg-teal-50 text-[#0F766E] border border-teal-200/70"
                    : "bg-slate-200/70 text-slate-700 border border-slate-300/70"
                }`}
              >
                {selectedProject.status?.replace("_", " ") || "active"}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider border ${
                isMember
                  ? "bg-teal-50 text-[#0F766E] border-teal-200/70"
                  : isOwner
                  ? "bg-amber-50 text-amber-800 border-amber-200/70"
                  : "bg-purple-50 text-purple-800 border-purple-200/70"
              }`}
            >
              Role: {userRole}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMember
              ? `Assigned issues for ${activeOrg?.name || "workspace"}`
              : selectedProject
              ? `Sprint and issue tracking for ${selectedProject.name}`
              : `Kanban sprint tracking for ${activeOrg?.name || "your workspace"}`}
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:w-56">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search issues..."
              className="w-full h-8.5 pl-8 pr-8 text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 rounded-lg outline-none transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Clear search"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Create Project Button (Owner & Manager) */}
          {(isOwner || isManager) && (
            <button
              type="button"
              onClick={() => setIsCreateProjectModalOpen(true)}
              className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
            >
              <FiFolder className="w-3.5 h-3.5 text-slate-500" />
              <span>Create Project</span>
            </button>
          )}

          {/* Create Issue Button */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap"
          >
            <FiPlus className="w-3.5 h-3.5" />
            <span>Create Issue</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* Project Switcher Bar                                */}
      {/* ─────────────────────────────────────────────────── */}
      {!isPageLoading && projects.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* All Projects Option (Without any label) */}
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId("all");
                router.replace("/projects?projectId=all");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedProjectId === "all"
                  ? "bg-[#0F766E] text-white shadow-2xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70"
              }`}
            >
              <FiLayers className="w-3.5 h-3.5" />
              <span>All Projects</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                  selectedProjectId === "all"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {projects.length}
              </span>
            </button>

            {/* Individual Project Options */}
            {projects.map((proj) => (
              <button
                key={proj.id}
                type="button"
                onClick={() => {
                  setSelectedProjectId(proj.id);
                  router.replace(`/projects?projectId=${proj.id}`);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedProjectId === proj.id
                    ? "bg-[#0F766E] text-white shadow-2xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/70"
                }`}
              >
                <FiFolder className="w-3.5 h-3.5" />
                <span>{proj.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* Selected Project Team Filter & Details Banner       */}
      {/* ─────────────────────────────────────────────────── */}
      {!isPageLoading && selectedProject && (
        <div className="bg-slate-50/80 border border-slate-200/80 rounded-lg p-2.5 sm:p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Team Members Avatar Filter Row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
                type="button"
                onClick={() => setSelectedMemberFilter(null)}
                className={`h-6.5 px-2.5 rounded-full text-[10px] font-semibold transition-all cursor-pointer flex items-center ${
                  selectedMemberFilter === null
                    ? "bg-[#0F766E] text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
                title="Show all tasks"
              >
                All
              </button>

              {projectTeamList.map((m) => {
                const isSelected =
                  selectedMemberFilter === m.id ||
                  selectedMemberFilter === m.name;

                return (
                  <button
                    key={m.id || m.name || m.email}
                    type="button"
                    onClick={() =>
                      setSelectedMemberFilter(isSelected ? null : m.id || m.name)
                    }
                    className={`w-6.5 h-6.5 rounded-full text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer relative group ${
                      isSelected
                        ? "bg-[#0F766E] text-white ring-2 ring-[#0F766E] ring-offset-2 ring-offset-white scale-105 shadow-xs"
                        : "bg-teal-100 text-[#0F766E] hover:bg-teal-200 hover:scale-105 border border-teal-200/80"
                    }`}
                    title={`Filter tasks assigned to ${m.name}`}
                  >
                    <span>{m.initial}</span>

                    {/* Tooltip */}
                    <span className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-900 text-white text-[10px] font-medium px-2 py-0.5 rounded shadow-md whitespace-nowrap z-30 pointer-events-none">
                      {m.name}
                    </span>
                  </button>
                );
              })}

              {projectTeamList.length === 0 && (
                <span className="text-[10px] text-slate-400 italic">
                  No assigned members
                </span>
              )}
            </div>

          <div className="flex items-center gap-2 text-xs shrink-0 flex-wrap">
            {(selectedProject.start_date || selectedProject.due_date) && (
              <div className="flex items-center gap-1.5 text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-xs">
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
              className="btn-secondary px-3 py-1 text-xs"
            >
              <FiInfo className="w-3.5 h-3.5 text-slate-400" />
              <span>Project Details</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────── */}
      {/* Board Area: Loading vs Zero State vs Kanban Columns */}
      {/* ─────────────────────────────────────────────────── */}
      {isPageLoading ? (
        <div className="space-y-4 animate-pulse">
          {/* Skeleton Project Switcher Bar */}
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs flex items-center gap-2">
            <div className="h-6 w-24 bg-slate-200 rounded-lg"></div>
            <div className="h-6 w-28 bg-slate-100 rounded-lg"></div>
            <div className="h-6 w-20 bg-slate-100 rounded-lg"></div>
          </div>

          {/* Skeleton Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {COLUMNS.map((col) => (
              <div
                key={col.id}
                className="rounded-lg p-2.5 border border-slate-200/80 bg-slate-100/75 flex flex-col min-h-[500px] space-y-3"
              >
                {/* Skeleton Column Header */}
                <div className="flex items-center justify-between pb-2.5 px-1 border-b border-slate-200/60">
                  <div className="h-4 bg-slate-300 rounded w-20"></div>
                  <div className="w-5 h-5 rounded-full bg-slate-200"></div>
                </div>

                {/* Skeleton Issue Cards */}
                <div className="space-y-2.5">
                  <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs space-y-2.5">
                    <div className="h-3 bg-teal-100 rounded w-14"></div>
                    <div className="h-3.5 bg-slate-200 rounded w-4/5"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <div className="h-3 bg-slate-100 rounded w-12"></div>
                      <div className="h-3 bg-slate-100 rounded w-16"></div>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs space-y-2.5">
                    <div className="h-3 bg-teal-100 rounded w-14"></div>
                    <div className="h-3.5 bg-slate-200 rounded w-3/5"></div>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <div className="h-3 bg-slate-100 rounded w-12"></div>
                      <div className="h-3 bg-slate-100 rounded w-14"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredTickets.length === 0 ? (
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {COLUMNS.map((col) => {
            const colTickets = filteredTickets.filter((t) => t.status === col.id);

            return (
              <div
                key={col.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.id)}
                className="rounded-lg p-2.5 border border-slate-200/80 bg-slate-100/75 flex flex-col min-h-[520px] transition-colors min-w-0"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2.5 px-1 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  <span>{col.label}</span>
                  <span className="w-5 h-5 rounded-full bg-white text-slate-600 flex items-center justify-center text-[10px] shadow-2xs font-bold border border-slate-200/60">
                    {colTickets.length}
                  </span>
                </div>

                {/* Tickets in Column */}
                <div className="space-y-2 flex-1 overflow-y-auto min-h-[100px]">
                  {colTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, ticket.id)}
                      className="bg-white p-3 rounded-lg border border-slate-200/90 shadow-2xs space-y-2 hover:border-slate-300 hover:shadow-xs transition-all group cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-mono font-semibold text-[#0F766E]">
                          {formatTaskKey(ticket, projects, selectedProject?.name)}
                        </span>
                        {!isMember && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTicketClick(ticket);
                              }}
                              className="text-slate-400 hover:text-red-600 p-0.5 rounded cursor-pointer"
                              title="Delete issue"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-slate-900 leading-snug">
                        {ticket.title}
                      </p>

                      {ticket.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2">
                          {ticket.description}
                        </p>
                      )}

                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span
                          className={`px-1.5 py-0.2 rounded-md uppercase font-semibold text-[9px] border ${
                            priorityColors[ticket.priority] || priorityColors.medium
                          }`}
                        >
                          {ticket.priority || "medium"}
                        </span>

                        <span className="text-slate-500 font-medium truncate max-w-[110px]" title={ticket.assignee}>
                          {ticket.assignee || "Unassigned"}
                        </span>
                      </div>

                      {/* Quick Move Status Selector */}
                      <div className="pt-0.5 flex items-center justify-between text-[10px] text-slate-400">
                        <span>Move:</span>
                        <select
                          value={ticket.status}
                          onChange={(e) => moveTicket(ticket.id, e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 text-[10px] text-slate-600 outline-none hover:border-slate-300 focus:border-[#0F766E]"
                        >
                          <option value="backlog">Backlog</option>
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="review">Review</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                    </div>
                  ))}

                  {colTickets.length === 0 && (
                    <div className="h-20 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-400 text-xs italic">
                      No issues in this column
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

      {/* ─────────────────────────────────────────────────── */}
      {/* Delete Task Confirmation Modal                      */}
      {/* ─────────────────────────────────────────────────── */}
      <DeleteTaskConfirmModal
        isOpen={!!deletingTicket}
        onClose={() => !isDeletingTicket && setDeletingTicket(null)}
        onConfirm={handleConfirmDeleteTicket}
        isLoading={isDeletingTicket}
        task={deletingTicket}
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
