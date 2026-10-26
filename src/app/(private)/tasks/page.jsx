"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { useSelector } from "react-redux";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
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
  FiEye,
  FiEdit3,
  FiChevronLeft,
  FiChevronRight,
  FiArrowRight,
  FiArrowLeft,
  FiChevronDown,
  FiFilter,
  FiCheckSquare,
  FiAlertCircle,
} from "react-icons/fi";
import { Select, DatePicker } from "antd";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
import { toast } from "react-toastify";
import projectService from "@/services/project.service";
import taskService from "@/services/task.service";
import CreateProjectModal from "@/components/CreateProjectModal";
import ProjectDetailsModal from "@/components/ProjectDetailsModal";
import DeleteTaskConfirmModal from "@/components/DeleteTaskConfirmModal";
import TaskStatusControl from "@/components/TaskStatusControl";
import { useOrganization } from "@/context/OrganizationContext";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { formatTaskKey } from "@/utils/commonFunction";
import { parseIssue } from "@/utils/issueHelper";

const COLUMNS = [
  {
    id: "backlog",
    label: "Backlog",
    bg: "bg-slate-100/70",
    border: "border-slate-200",
  },
  {
    id: "todo",
    label: "To Do",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
  {
    id: "in-progress",
    label: "In Progress",
    bg: "bg-teal-50/60",
    border: "border-teal-200",
  },
  {
    id: "review",
    label: "In Review",
    bg: "bg-purple-50/60",
    border: "border-purple-200",
  },
  {
    id: "done",
    label: "Done",
    bg: "bg-emerald-50/60",
    border: "border-emerald-200",
  },
];

// Consistent avatar colors per starting letter
const LETTER_AVATAR_COLORS = {
  A: "bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200/80",
  B: "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200/80",
  C: "bg-teal-100 text-[#0F766E] hover:bg-teal-200 border border-teal-200/80",
  D: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200/80",
  E: "bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200/80",
  F: "bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200/80",
  G: "bg-lime-100 text-lime-800 hover:bg-lime-200 border border-lime-200/80",
  H: "bg-pink-100 text-pink-700 hover:bg-pink-200 border border-pink-200/80",
  I: "bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-200/80",
  J: "bg-red-100 text-red-700 hover:bg-red-200 border border-red-200/80",
  K: "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200/80",
  L: "bg-green-100 text-green-700 hover:bg-green-200 border border-green-200/80",
  M: "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200 border border-fuchsia-200/80",
  N: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200/80",
  O: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-200/80",
  P: "bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200/80",
  Q: "bg-teal-100 text-[#0F766E] hover:bg-teal-200 border border-teal-200/80",
  R: "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200/80",
  S: "bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200/80",
  T: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200/80",
  U: "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200/80",
  V: "bg-violet-100 text-violet-700 hover:bg-violet-200 border border-violet-200/80",
  W: "bg-cyan-100 text-cyan-700 hover:bg-cyan-200 border border-cyan-200/80",
  X: "bg-fuchsia-100 text-fuchsia-700 hover:bg-fuchsia-200 border border-fuchsia-200/80",
  Y: "bg-orange-100 text-orange-700 hover:bg-orange-200 border border-orange-200/80",
  Z: "bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200/80",
};

const FALLBACK_PALETTES = Object.values(LETTER_AVATAR_COLORS);

const getAvatarColorByLetter = (str) => {
  if (!str) return "bg-teal-100 text-[#0F766E] hover:bg-teal-200 border border-teal-200/80";
  const char = String(str).trim().charAt(0).toUpperCase();
  if (LETTER_AVATAR_COLORS[char]) {
    return LETTER_AVATAR_COLORS[char];
  }
  const code = char.charCodeAt(0) || 0;
  return FALLBACK_PALETTES[code % FALLBACK_PALETTES.length];
};

function TasksBoardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams.get("projectId");
  const querySearch = searchParams.get("search");
  const queryPriority = searchParams.get("priority");
  const queryStatus = searchParams.get("status");
  const queryDate = searchParams.get("date");
  const queryPage = searchParams.get("page");
  const queryLimit = searchParams.get("limit");

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const {
    currentOrg,
    organizations,
    members = [],
    loadingOrgs,
  } = useOrganization();

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(
    queryProjectId || "",
  );
  const [priorityFilter, setPriorityFilter] = useState(queryPriority || "all");
  const [statusFilter, setStatusFilter] = useState(queryStatus || "all");
  const [dateFilter, setDateFilter] = useState(queryDate || "");
  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState(querySearch || "");
  const [debouncedSearch, setDebouncedSearch] = useState(querySearch || "");
  const [currentPage, setCurrentPage] = useState(
    queryPage ? Math.max(1, parseInt(queryPage, 10)) : 1,
  );
  const [pageSize, setPageSize] = useState(queryLimit || "50");
  const [totalTasksCount, setTotalTasksCount] = useState(0);
  const [columnCardLimits, setColumnCardLimits] = useState({});
  const [selectedMemberFilter, setSelectedMemberFilter] = useState(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [dragOverCol, setDragOverCol] = useState(null);

  // Modals
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] =
    useState(false);
  const [projectDetailsModalData, setProjectDetailsModalData] = useState(null);
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [isDeletingTicket, setIsDeletingTicket] = useState(false);
  const [updatingTicketId, setUpdatingTicketId] = useState(null);

  const activeOrg =
    currentOrg?.organizations ||
    currentOrg ||
    organizations?.[0]?.organizations ||
    organizations?.[0];
  const userRole =
    currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;
  const isOwner = userRole === OWNER_ROLE;
  const isManager = userRole === MANAGER_ROLE;

  // Helper to sync filter and pagination changes to URL query parameters
  const updateUrlParams = useCallback(
    (newParams) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(newParams).forEach(([key, val]) => {
        if (
          !val ||
          (val === "all" && key !== "limit") ||
          (key === "page" && String(val) === "1") ||
          (key === "limit" && String(val) === "50")
        ) {
          params.delete(key);
        } else {
          params.set(key, String(val));
        }
      });
      const queryString = params.toString();
      router.replace(queryString ? `/tasks?${queryString}` : "/tasks");
    },
    [router, searchParams],
  );

  // Debounce search input to avoid spamming server queries
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      if ((querySearch || "") !== (search || "")) {
        setCurrentPage(1);
        updateUrlParams({ search, page: "1" });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search, querySearch, updateUrlParams]);

  // Sync page and limit from URL query params
  useEffect(() => {
    if (queryPage) {
      const p = Math.max(1, parseInt(queryPage, 10));
      if (p !== currentPage) setCurrentPage(p);
    } else {
      setCurrentPage(1);
    }
  }, [queryPage]);

  useEffect(() => {
    if (queryLimit && queryLimit !== pageSize) {
      setPageSize(queryLimit);
    }
  }, [queryLimit]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    updateUrlParams({ page: String(newPage) });
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    updateUrlParams({ limit: newSize, page: "1" });
  };

  const handlePriorityChange = (val) => {
    setPriorityFilter(val);
    setCurrentPage(1);
    updateUrlParams({ priority: val, page: "1" });
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
    updateUrlParams({ status: val, page: "1" });
  };

  const handleDateRangeChange = (dates, dateStrings) => {
    setCurrentPage(1);
    if (dateStrings && dateStrings[0] && dateStrings[1]) {
      const rangeStr = `${dateStrings[0]}_${dateStrings[1]}`;
      setDateFilter(rangeStr);
      updateUrlParams({ date: rangeStr, page: "1" });
    } else {
      setDateFilter("");
      updateUrlParams({ date: "", page: "1" });
    }
  };

  const rangeValue = useMemo(() => {
    if (!dateFilter) return null;
    if (dateFilter.includes("_")) {
      const [start, end] = dateFilter.split("_");
      if (start && end && dayjs(start).isValid() && dayjs(end).isValid()) {
        return [dayjs(start), dayjs(end)];
      }
    } else if (dateFilter.includes(":")) {
      const [start, end] = dateFilter.split(":");
      if (start && end && dayjs(start).isValid() && dayjs(end).isValid()) {
        return [dayjs(start), dayjs(end)];
      }
    } else if (dayjs(dateFilter).isValid()) {
      return [dayjs(dateFilter), dayjs(dateFilter)];
    }
    return null;
  }, [dateFilter]);

  const handleClearAllFilters = () => {
    setPriorityFilter("all");
    setStatusFilter("all");
    setDateFilter("");
    setSearch("");
    setDebouncedSearch("");
    setSelectedMemberFilter(null);
    setCurrentPage(1);
    updateUrlParams({ priority: "all", status: "all", date: "", search: "", page: "1" });
  };

  const hasActiveFilters = Boolean(
    (priorityFilter && priorityFilter !== "all") ||
      (statusFilter && statusFilter !== "all") ||
      dateFilter ||
      search.trim() ||
      selectedMemberFilter,
  );

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

  // Sync priority, status, date and search URL query params if present
  useEffect(() => {
    if (queryPriority !== null && queryPriority !== undefined) {
      setPriorityFilter(queryPriority);
    } else {
      setPriorityFilter("all");
    }
  }, [queryPriority]);

  useEffect(() => {
    if (queryStatus !== null && queryStatus !== undefined) {
      setStatusFilter(queryStatus);
    } else {
      setStatusFilter("all");
    }
  }, [queryStatus]);

  useEffect(() => {
    if (queryDate !== null && queryDate !== undefined) {
      setDateFilter(queryDate);
    } else {
      setDateFilter("");
    }
  }, [queryDate]);

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
  const isFetchingProjectsRef = useRef(false);
  const lastFetchedProjectsKeyRef = useRef(null);
  const projectsRef = useRef(projects);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const loadProjects = useCallback(
    async (force = false) => {
      const orgId = activeOrg?.id;
      if (!orgId) {
        if (!loadingOrgs) {
          setLoadingProjects(false);
        }
        return;
      }
      const fetchKey = `${orgId}:${user?.id || ""}:${userRole}`;
      if (
        !force &&
        lastFetchedProjectsKeyRef.current === fetchKey &&
        projectsRef.current.length > 0
      ) {
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
            if (
              !prev ||
              (prev !== "all" && !fetchedProjects.some((p) => p.id === prev))
            ) {
              return queryProjectId &&
                (queryProjectId === "all" ||
                  fetchedProjects.some((p) => p.id === queryProjectId))
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
    },
    [activeOrg?.id, user?.id, userRole, queryProjectId, loadingOrgs],
  );

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Tickets ref tracking & loading
  const isFetchingTicketsRef = useRef(false);
  const lastFetchedTicketsKeyRef = useRef(null);
  const ticketsRef = useRef(tickets);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);

  const loadTickets = useCallback(
    async (force = false) => {
      const orgId = activeOrg?.id;
      if (!orgId) {
        if (!loadingOrgs) {
          setLoadingTickets(false);
        }
        return;
      }
      const fetchKey = `${orgId}:${selectedProjectId || "all"}:${priorityFilter || "all"}:${statusFilter || "all"}:${dateFilter || ""}:${debouncedSearch || ""}:${currentPage}:${pageSize}:${user?.id || ""}:${userRole}`;
      if (
        !force &&
        lastFetchedTicketsKeyRef.current === fetchKey &&
        ticketsRef.current.length > 0
      ) {
        setLoadingTickets(false);
        return;
      }
      if (isFetchingTicketsRef.current) return;
      try {
        isFetchingTicketsRef.current = true;
        setLoadingTickets(true);
        const data = await taskService.getTasks({
          organizationId: orgId,
          projectId:
            selectedProjectId && selectedProjectId !== "all"
              ? selectedProjectId
              : undefined,
          priority:
            priorityFilter && priorityFilter !== "all"
              ? priorityFilter
              : undefined,
          status:
            statusFilter && statusFilter !== "all"
              ? statusFilter
              : undefined,
          date: dateFilter || undefined,
          search: debouncedSearch || undefined,
          page: currentPage,
          limit: pageSize === "all" ? undefined : pageSize,
          userId: user?.id,
          userRole,
          userName: user?.full_name || user?.name || "",
          userEmail: user?.email || "",
          force,
        });
        lastFetchedTicketsKeyRef.current = fetchKey;
        setTickets(data || []);
        setTotalTasksCount(data.totalCount ?? (data || []).length);
      } catch (err) {
        console.error("loadTickets error:", err);
      } finally {
        isFetchingTicketsRef.current = false;
        setLoadingTickets(false);
      }
    },
    [
      activeOrg?.id,
      selectedProjectId,
      priorityFilter,
      statusFilter,
      dateFilter,
      debouncedSearch,
      currentPage,
      pageSize,
      user?.id,
      userRole,
      user?.full_name,
      user?.name,
      user?.email,
      loadingOrgs,
    ],
  );

  useEffect(() => {
    loadTickets(true);
  }, [loadTickets]);

  // Listen for task creation or updates from dedicated pages/modals
  useEffect(() => {
    const handleTaskChange = (e) => {
      if (e?.detail?.id) {
        setTickets((prev) =>
          prev.map((t) => (t.id === e.detail.id ? { ...t, ...e.detail } : t)),
        );
      }
      loadTickets(true);
    };
    window.addEventListener("workgrid-task-created", handleTaskChange);
    window.addEventListener("workgrid-task-updated", handleTaskChange);
    return () => {
      window.removeEventListener("workgrid-task-created", handleTaskChange);
      window.removeEventListener("workgrid-task-updated", handleTaskChange);
    };
  }, [loadTickets]);

  useEffect(() => {
    if (!loadingOrgs && !activeOrg?.id) {
      setLoadingProjects(false);
      setLoadingTickets(false);
    }
  }, [loadingOrgs, activeOrg?.id]);

  const isPageLoading =
    loadingOrgs ||
    loadingProjects ||
    (loadingTickets && tickets.length === 0 && projects.length === 0);

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
          (pm) => (pm.user_id || pm.id) === uId,
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
      const cleanSelectedName = selectedProject?.name?.trim().toLowerCase();
      const matchesProj =
        t.project_id === selectedProject.id ||
        t.projectId === selectedProject.id ||
        (cleanSelectedName &&
          (t.project_name?.trim().toLowerCase() === cleanSelectedName ||
           t.projectName?.trim().toLowerCase() === cleanSelectedName));
      if (
        matchesProj &&
        t.assignee &&
        t.assignee.toLowerCase() !== "unassigned"
      ) {
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

  const moveTicket = async (ticketId, nextStatus) => {
    const targetTicket = tickets.find((t) => t.id === ticketId);
    // Immediate optimistic UI update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t)),
    );
    try {
      setUpdatingTicketId(ticketId);
      await taskService.updateTask(
        ticketId,
        {
          status: nextStatus,
          projectId:
            targetTicket?.projectId ||
            targetTicket?.project_id ||
            (selectedProjectId !== "all" ? selectedProjectId : undefined),
          project_id:
            targetTicket?.project_id ||
            targetTicket?.projectId ||
            (selectedProjectId !== "all" ? selectedProjectId : undefined),
          projectName:
            targetTicket?.projectName ||
            targetTicket?.project_name ||
            selectedProject?.name,
          project_name:
            targetTicket?.project_name ||
            targetTicket?.projectName ||
            selectedProject?.name,
        },
        { userId: user?.id, userRole, organizationId: activeOrg?.id },
      );
    } catch (err) {
      console.error("Failed to update task status:", err);
      toast.error("Failed to update task status.");
    } finally {
      setUpdatingTicketId(null);
    }
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
    e.dataTransfer.setData("text/plain", ticketId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, statusId) => {
    e.preventDefault();
    setDragOverCol(null);
    const ticketId =
      e.dataTransfer.getData("ticketId") || e.dataTransfer.getData("text/plain");
    if (ticketId) {
      moveTicket(ticketId, statusId);
    }
  };

  // Filter tickets by project and search query
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Project filter
      if (selectedProjectId && selectedProjectId !== "all") {
        const cleanSelectedName = selectedProject?.name?.trim().toLowerCase();
        const matchesProject =
          t.project_id === selectedProjectId ||
          t.projectId === selectedProjectId ||
          (cleanSelectedName &&
            (t.project_name?.trim().toLowerCase() === cleanSelectedName ||
             t.projectName?.trim().toLowerCase() === cleanSelectedName));
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
      const displayKey = formatTaskKey(
        t,
        projects,
        selectedProject?.name,
      ).toLowerCase();
      return (
        displayKey.includes(q) ||
        t.title?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.assignee?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });
  }, [
    tickets,
    selectedProjectId,
    selectedProject,
    selectedMemberFilter,
    search,
    projects,
  ]);

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
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#0F766E] font-medium cursor-pointer transition-colors group"
          >
            <FiArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>All Projects</span>
          </button>
        </div>

        {/* Header Action Controls & Backend Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 sm:w-44 md:w-48">
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

          {/* Ant Design Priority Filter */}
          <Select
            value={priorityFilter && priorityFilter !== "all" ? priorityFilter : undefined}
            onChange={(val) => handlePriorityChange(val || "all")}
            placeholder="Priority"
            allowClear
            className="w-32 sm:w-36 h-8.5 text-xs"
            options={[
              { value: "urgent", label: "Urgent" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />

          {/* Ant Design Status Filter */}
          <Select
            value={statusFilter && statusFilter !== "all" ? statusFilter : undefined}
            onChange={(val) => handleStatusChange(val || "all")}
            placeholder="Status"
            allowClear
            className="w-32 sm:w-36 h-8.5 text-xs"
            options={[
              { value: "backlog", label: "Backlog" },
              { value: "todo", label: "To Do" },
              { value: "in-progress", label: "In Progress" },
              { value: "review", label: "In Review" },
              { value: "done", label: "Done" },
            ]}
          />

          {/* Ant Design Date Range Filter */}
          <RangePicker
            value={rangeValue}
            onChange={handleDateRangeChange}
            placeholder={["Start Date", "End Date"]}
            className="h-8.5 text-xs w-56 sm:w-60"
            allowClear
          />

          {/* Clear All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="h-8.5 px-2.5 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <FiX className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          {/* Create Issue Button */}
          <button
            type="button"
            onClick={() => {
              const url =
                selectedProjectId && selectedProjectId !== "all"
                  ? `/issues/create?projectId=${selectedProjectId}`
                  : `/issues/create`;
              router.push(url);
            }}
            className="btn-primary px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap cursor-pointer"
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
            {/* All Projects Option */}
            <button
              type="button"
              onClick={() => {
                setSelectedProjectId("all");
                router.replace("/tasks?projectId=all");
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
                  router.replace(`/tasks?projectId=${proj.id}`);
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
                      : `${getAvatarColorByLetter(m.initial || m.name)} hover:scale-105`
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
            {hasActiveFilters ? (
              <FiFilter className="w-8 h-8" />
            ) : projects.length === 0 ? (
              <FiFolder className="w-8 h-8" />
            ) : (
              <FiLayers className="w-8 h-8" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {hasActiveFilters
                ? "No Matching Issues Found"
                : projects.length === 0
                  ? "No Projects Created Yet"
                  : selectedProject
                    ? `No Issues in ${selectedProject.name}`
                    : "No Issues Created Yet"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {hasActiveFilters
                ? "No tasks match your selected filter criteria. Try adjusting or resetting your filters to see more results."
                : projects.length === 0
                  ? "Create your first project to start organizing issues and tracking agile sprints."
                  : "Your backlog is clear. Click the button below to create your first issue and start sprint planning."}
            </p>
          </div>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleClearAllFilters}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all cursor-pointer"
            >
              <FiX className="w-4 h-4" />
              <span>Reset All Filters</span>
            </button>
          ) : projects.length === 0 ? (
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
                onClick={() => {
                  const url =
                    selectedProjectId && selectedProjectId !== "all"
                      ? `/issues/create?projectId=${selectedProjectId}`
                      : `/issues/create`;
                  router.push(url);
                }}
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
            {COLUMNS.map((col) => {
              const colTickets = filteredTickets.filter(
                (t) => t.status === col.id,
              );
              const colLimit = columnCardLimits[col.id] || 15;
              const visibleTickets = colTickets.slice(0, colLimit);
              const hasMoreInCol = colTickets.length > colLimit;

              return (
                <div
                  key={col.id}
                  onDragOver={handleDragOver}
                  onDragEnter={() => setDragOverCol(col.id)}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget)) return;
                    setDragOverCol(null);
                  }}
                  onDrop={(e) => handleDrop(e, col.id)}
                  className={`rounded-lg p-2.5 border transition-all flex flex-col min-h-[520px] min-w-0 ${
                    dragOverCol === col.id
                      ? "border-[#0F766E] ring-2 ring-[#0F766E]/20 bg-teal-50/50"
                      : "border-slate-200/80 bg-slate-100/75"
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2.5 px-1 text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    <span>{col.label}</span>
                    <span className="w-5 h-5 rounded-full bg-white text-slate-600 flex items-center justify-center text-[10px] shadow-2xs font-bold border border-slate-200/60">
                      {colTickets.length}
                    </span>
                  </div>

                  {/* Tickets in Column */}
                  <div
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, col.id)}
                    className="space-y-2 flex-1 overflow-y-auto min-h-[120px]"
                  >
                    {visibleTickets.map((ticket) => {
                      const parsed = parseIssue(ticket) || ticket;
                      const subtasks = parsed.subtasks || [];
                      const completedSubtasks = subtasks.filter((s) => s.completed).length;
                      const totalSubtasks = subtasks.length;
                      const dueDate = ticket.due_date || ticket.dueDate || parsed.dueDate || parsed.due_date;
                      const isOverdue = Boolean(dueDate && new Date(dueDate) < new Date() && ticket.status !== "done");

                      return (
                        <div
                          key={ticket.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, ticket.id)}
                          onClick={() => router.push(`/issues/${ticket.id}`)}
                          className={`bg-white p-3 rounded-lg border shadow-2xs space-y-2 transition-all group cursor-pointer ${
                            isOverdue
                              ? "border-rose-200/90 hover:border-rose-400 hover:shadow-xs"
                              : "border-slate-200/90 hover:border-[#0F766E]/40 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-mono font-semibold text-[#0F766E]">
                                {formatTaskKey(
                                  ticket,
                                  projects,
                                  selectedProject?.name,
                                )}
                              </span>
                              {parsed.isBlocker && (
                                <span className="px-1 py-0.2 rounded text-[8.5px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                                  Blocker
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/issues/${ticket.id}`);
                                }}
                                className="text-slate-400 hover:text-[#0F766E] p-0.5 rounded cursor-pointer"
                                title="View details"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <p className="text-xs font-semibold text-slate-900 leading-snug">
                            {ticket.title}
                          </p>

                          {ticket.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-2">
                              {ticket.description
                                .replace(/<!--wg_meta:[\s\S]*?-->/g, "")
                                .trim()}
                            </p>
                          )}

                          {/* Extra indicators: Due date & Subtask progress */}
                          {(dueDate || totalSubtasks > 0) && (
                            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                              {dueDate && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border ${
                                    isOverdue
                                      ? "bg-rose-50 text-rose-700 font-semibold border-rose-200"
                                      : "bg-slate-50 text-slate-500 border-slate-200"
                                  }`}
                                  title={isOverdue ? `Overdue since ${new Date(dueDate).toLocaleDateString()}` : `Due ${new Date(dueDate).toLocaleDateString()}`}
                                >
                                  <FiClock className={`w-2.5 h-2.5 shrink-0 ${isOverdue ? "text-rose-600 animate-pulse" : "text-slate-400"}`} />
                                  <span>{new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                                  {isOverdue && <span className="font-bold text-rose-600">!</span>}
                                </span>
                              )}
                              {totalSubtasks > 0 && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] border ${
                                    completedSubtasks === totalSubtasks
                                      ? "bg-emerald-50 text-emerald-700 font-medium border-emerald-200"
                                      : "bg-slate-50 text-slate-600 border-slate-200"
                                  }`}
                                  title={`${completedSubtasks} of ${totalSubtasks} subtasks completed`}
                                >
                                  <FiCheckSquare className={`w-2.5 h-2.5 shrink-0 ${completedSubtasks === totalSubtasks ? "text-emerald-600" : "text-slate-400"}`} />
                                  <span>{completedSubtasks}/{totalSubtasks}</span>
                                </span>
                              )}
                            </div>
                          )}

                          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                            <span
                              className={`px-1.5 py-0.2 rounded-md uppercase font-semibold text-[9px] border ${
                                priorityColors[ticket.priority] ||
                                priorityColors.medium
                              }`}
                            >
                              {ticket.priority || "medium"}
                            </span>

                            <span
                              className="text-slate-500 font-medium truncate max-w-[110px]"
                              title={ticket.assignee}
                            >
                              {ticket.assignee || "Unassigned"}
                            </span>
                          </div>

                          {/* Interactive Status Changer & Quick Stage Flow */}
                          <div
                            className="pt-1 flex items-center justify-between"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <TaskStatusControl
                              status={ticket.status}
                              loading={updatingTicketId === ticket.id}
                              onChange={(val) => moveTicket(ticket.id, val)}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Column load more button if column has more than colLimit tasks */}
                    {hasMoreInCol && (
                      <button
                        type="button"
                        onClick={() =>
                          setColumnCardLimits((prev) => ({
                            ...prev,
                            [col.id]: (prev[col.id] || 15) + 20,
                          }))
                        }
                        className="w-full py-2 px-3 text-[11px] font-semibold text-[#0F766E] hover:text-[#0D655E] bg-teal-50/80 hover:bg-teal-100 border border-teal-200/70 rounded-lg transition-colors cursor-pointer text-center"
                      >
                        + Show {Math.min(20, colTickets.length - colLimit)} more ({colTickets.length - colLimit} remaining)
                      </button>
                    )}

                    {colLimit > 15 && (
                      <button
                        type="button"
                        onClick={() =>
                          setColumnCardLimits((prev) => ({
                            ...prev,
                            [col.id]: 15,
                          }))
                        }
                        className="w-full py-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors text-center cursor-pointer"
                      >
                        Collapse to 15
                      </button>
                    )}

                    {colTickets.length === 0 && (
                      <div
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.id)}
                        className={`h-24 rounded-lg border-2 border-dashed flex items-center justify-center text-xs transition-colors ${
                          dragOverCol === col.id
                            ? "border-[#0F766E] bg-teal-50 text-[#0F766E] font-medium"
                            : "border-slate-200 text-slate-400 italic"
                        }`}
                      >
                        {dragOverCol === col.id
                          ? "Drop to move to " + col.label
                          : "No issues in this column"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─────────────────────────────────────────────────── */}
          {/* Board Pagination Bar                                */}
          {/* ─────────────────────────────────────────────────── */}
          {totalTasksCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:px-4 rounded-lg border border-slate-200/80 shadow-2xs select-none">
              {/* Count status */}
              <div className="text-xs text-slate-600 font-medium">
                {pageSize === "all" ? (
                  <span>
                    Showing all <strong className="text-slate-900 font-semibold">{totalTasksCount}</strong> tasks
                  </span>
                ) : (
                  <span>
                    Showing{" "}
                    <strong className="text-slate-900 font-semibold">
                      {(currentPage - 1) * Number(pageSize) + 1}
                    </strong>
                    –
                    <strong className="text-slate-900 font-semibold">
                      {Math.min(currentPage * Number(pageSize), totalTasksCount)}
                    </strong>{" "}
                    of <strong className="text-slate-900 font-semibold">{totalTasksCount}</strong> tasks
                  </span>
                )}
              </div>

              {/* Page Nav Buttons */}
              {pageSize !== "all" && Math.ceil(totalTasksCount / Number(pageSize)) > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium flex items-center gap-1 transition-all ${
                      currentPage <= 1
                        ? "bg-slate-50 text-slate-300 border-slate-200/60 cursor-not-allowed"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-[#0F766E] cursor-pointer"
                    }`}
                  >
                    <FiChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const totalPages = Math.ceil(totalTasksCount / Number(pageSize));
                      const pages = [];
                      for (let i = 1; i <= totalPages; i++) {
                        if (
                          i === 1 ||
                          i === totalPages ||
                          (i >= currentPage - 1 && i <= currentPage + 1)
                        ) {
                          pages.push(i);
                        } else if (pages[pages.length - 1] !== "...") {
                          pages.push("...");
                        }
                      }
                      return pages.map((p, idx) =>
                        p === "..." ? (
                          <span key={`dots-${idx}`} className="px-1 text-slate-400 text-xs">
                            ...
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePageChange(p)}
                            className={`w-7 h-7 text-xs rounded-md font-semibold transition-all cursor-pointer ${
                              currentPage === p
                                ? "bg-[#0F766E] text-white shadow-2xs"
                                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    disabled={currentPage >= Math.ceil(totalTasksCount / Number(pageSize))}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className={`px-2.5 py-1 text-xs rounded-md border font-medium flex items-center gap-1 transition-all ${
                      currentPage >= Math.ceil(totalTasksCount / Number(pageSize))
                        ? "bg-slate-50 text-slate-300 border-slate-200/60 cursor-not-allowed"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-[#0F766E] cursor-pointer"
                    }`}
                  >
                    <span className="hidden sm:inline">Next</span>
                    <FiChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Page Size Selector */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Per page:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {["25", "50", "100", "all"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handlePageSizeChange(size)}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer ${
                        pageSize === size
                          ? "bg-white text-[#0F766E] shadow-2xs border border-slate-200/80"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {size === "all" ? "All" : size}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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

export default function TasksPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs font-semibold text-slate-400">
          Loading tasks board...
        </div>
      }
    >
      <TasksBoardContent />
    </Suspense>
  );
}
