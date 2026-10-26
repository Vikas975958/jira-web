"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  FiSearch,
  FiBell,
  FiHelpCircle,
  FiSettings,
  FiLogOut,
  FiUser,
  FiGrid,
  FiCheck,
  FiFolder,
  FiLayout,
  FiX,
  FiArrowRight,
  FiUsers,
  FiAlertTriangle,
  FiClock,
  FiCheckCircle,
  FiCommand,
} from "react-icons/fi";
import { LuPanelLeftClose, LuPanelLeftOpen } from "react-icons/lu";
import { useSidebar } from "@/context/SidebarContext";
import { useOrganization } from "@/context/OrganizationContext";
import projectService from "@/services/project.service";
import taskService from "@/services/task.service";
import JiraLogo from "./JiraLogo";
import LogoutConfirmModal from "./LogoutConfirmModal";
import Cookies from "js-cookie";
import authService from "@/services/auth.service";
import { emptyStore } from "@/store/rootReducer";
import { getNameInitials, formatTaskKey } from "@/utils/commonFunction";
import { MEMBER_ROLE } from "@/utils/constants";

export default function Header({ onCreateIssueClick }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const { isCollapsed, toggleSidebar, toggleMobile } = useSidebar();
  const { currentOrg, organizations, members = [] } = useOrganization();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const notifPanelRef = useRef(null);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchProjects, setSearchProjects] = useState([]);
  const [searchTasks, setSearchTasks] = useState([]);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  const dropdownRef = useRef(null);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const hasLoadedSearchDataRef = useRef(false);

  const activeOrg =
    currentOrg?.organizations ||
    currentOrg ||
    organizations?.[0]?.organizations ||
    organizations?.[0];
  const orgId = activeOrg?.id;
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;

  // Lazily load projects and tasks for quick search when focused or queried
  const loadSearchData = useCallback(async () => {
    if (!orgId || hasLoadedSearchDataRef.current) return;
    try {
      setIsLoadingSearch(true);
      const [projs, tsks] = await Promise.all([
        projectService.getProjects({
          organizationId: orgId,
          userId: user?.id,
          userRole,
          limit: 30,
        }),
        taskService.getTasks({
          organizationId: orgId,
          userId: user?.id,
          userRole,
          userName: user?.full_name || user?.name || "",
          userEmail: user?.email || "",
          limit: 50,
        }),
      ]);
      setSearchProjects(projs || []);
      setSearchTasks(tsks || []);
      hasLoadedSearchDataRef.current = true;
    } catch (e) {
      console.error("Failed to load search data:", e);
    } finally {
      setIsLoadingSearch(false);
    }
  }, [orgId, user?.id, userRole, user?.full_name, user?.name, user?.email]);

  // Global Keyboard Shortcuts (Ctrl+K, Cmd+K, '/', '?', 'G+T', 'G+D', 'G+P')
  useEffect(() => {
    let gPressed = false;
    let gTimer = null;

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl?.tagName === "INPUT" ||
        activeEl?.tagName === "TEXTAREA" ||
        activeEl?.isContentEditable;

      // Ctrl+K or '/' — open search
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !isInput)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
        loadSearchData();
        return;
      }

      // Escape — close search, notifications, or shortcuts modal
      if (e.key === "Escape") {
        if (isSearchOpen) {
          setIsSearchOpen(false);
          searchInputRef.current?.blur();
        }
        setNotificationsOpen(false);
        setShowShortcutsModal(false);
        return;
      }

      // '?' — open shortcuts modal (when not in input)
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcutsModal(true);
        return;
      }

      // G+T, G+P, G+D — quick navigation shortcuts
      if (!isInput) {
        if (e.key === "g" || e.key === "G") {
          gPressed = true;
          clearTimeout(gTimer);
          gTimer = setTimeout(() => { gPressed = false; }, 1500);
          return;
        }

        if (gPressed) {
          if (e.key === "t" || e.key === "T") {
            gPressed = false;
            clearTimeout(gTimer);
            router.push("/tasks");
          } else if (e.key === "p" || e.key === "P") {
            gPressed = false;
            clearTimeout(gTimer);
            router.push("/projects");
          } else if (e.key === "d" || e.key === "D") {
            gPressed = false;
            clearTimeout(gTimer);
            router.push("/dashboard");
          } else {
            gPressed = false;
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(gTimer);
    };
  }, [isSearchOpen, loadSearchData, router]);

  // Close search, notifications, and dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (
        notifPanelRef.current &&
        !notifPanelRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.signOut();
      Cookies.remove("token", { path: "/" });
      dispatch(emptyStore());
      toast.info("You have been signed out.");
      setIsLogoutModalOpen(false);
      router.push("/signin");
    } catch (err) {
      console.error("Logout error:", err);
      Cookies.remove("token", { path: "/" });
      dispatch(emptyStore());
      setIsLogoutModalOpen(false);
      router.push("/signin");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Submit search query
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearchOpen(false);
    router.push(`/tasks?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Select Search Item
  const handleSelectProject = (projId) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    router.push(`/tasks?projectId=${projId}`);
  };

  const handleSelectTask = (task) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    router.push(`/issues/${task.id}`);
  };

  const handleSelectMember = (member) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    const query = member.email || member.full_name || member.name || "";
    router.push(`/team?search=${encodeURIComponent(query)}`);
  };

  const handleSelectQuickLink = (href) => {
    setIsSearchOpen(false);
    setSearchQuery("");
    router.push(href);
  };

  // Filtered Results
  const trimmed = searchQuery.trim().toLowerCase();

  const matchingProjects = useMemo(() => {
    if (!trimmed) return searchProjects.slice(0, 3);
    return searchProjects
      .filter(
        (p) =>
          p.name?.toLowerCase().includes(trimmed) ||
          p.description?.toLowerCase().includes(trimmed)
      )
      .slice(0, 4);
  }, [searchProjects, trimmed]);

  const matchingTasks = useMemo(() => {
    if (!trimmed) return [];
    return searchTasks
      .filter((t) => {
        const displayKey = formatTaskKey(t, searchProjects).toLowerCase();
        return (
          displayKey.includes(trimmed) ||
          t.title?.toLowerCase().includes(trimmed) ||
          t.id?.toLowerCase().includes(trimmed) ||
          t.assignee?.toLowerCase().includes(trimmed) ||
          t.description?.toLowerCase().includes(trimmed)
        );
      })
      .slice(0, 5);
  }, [searchTasks, searchProjects, trimmed]);

  const matchingMembers = useMemo(() => {
    if (!trimmed) return [];
    const list = members.filter(
      (m) =>
        (m.full_name || m.name)?.toLowerCase().includes(trimmed) ||
        m.email?.toLowerCase().includes(trimmed) ||
        (m.role || m.intended_role)?.toLowerCase().includes(trimmed)
    );

    if (user?.id) {
      list.sort((a, b) => {
        const aIsMe = (a.user_id === user.id || a.id === user.id || a.profiles?.id === user.id) ? 1 : 0;
        const bIsMe = (b.user_id === user.id || b.id === user.id || b.profiles?.id === user.id) ? 1 : 0;
        return bIsMe - aIsMe;
      });
    }

    return list.slice(0, 3);
  }, [members, trimmed, user?.id]);

  const quickPages = [
    { title: "Dashboard", href: "/dashboard", icon: FiGrid, desc: "Workspace activity & metrics" },
    { title: "Tasks Board", href: "/tasks", icon: FiLayout, desc: "Kanban board & issue tracking" },
    { title: "Projects", href: "/projects", icon: FiFolder, desc: "Workspace project directory" },
    { title: "Team Management", href: "/team", icon: FiUsers, desc: "Members & role assignments" },
    { title: "Settings", href: "/settings", icon: FiSettings, desc: "Workspace configurations" },
  ];

  const matchingPages = useMemo(() => {
    if (!trimmed) return quickPages;
    return quickPages.filter(
      (p) =>
        p.title.toLowerCase().includes(trimmed) ||
        p.desc.toLowerCase().includes(trimmed)
    );
  }, [trimmed]);

  const hasResults =
    matchingProjects.length > 0 ||
    matchingTasks.length > 0 ||
    matchingMembers.length > 0 ||
    matchingPages.length > 0;

  const userName = user?.name || user?.email?.split("@")[0] || "Team Member";
  const userInitials = getNameInitials(userName) || "U";
  const userRoleDisplay = user?.role || "Software Engineer";

  return (
    <header className="h-13 sm:h-14 border-b border-slate-200/90 bg-white sticky top-0 z-40 px-3 md:px-5 flex items-center justify-between select-none">
      {/* Left side: Sidebar Toggle & Logo */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              toggleMobile();
            } else {
              toggleSidebar();
            }
          }}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <LuPanelLeftOpen className="w-4.5 h-4.5" />
          ) : (
            <LuPanelLeftClose className="w-4.5 h-4.5" />
          )}
        </button>

        <Link href="/dashboard" className="flex items-center gap-2">
          <JiraLogo className="w-6.5 h-6.5" textColor="text-slate-900" />
        </Link>
      </div>

      {/* Right side: Search, Notifications, User menu */}
      <div className="flex items-center gap-1.5 sm:gap-2" ref={dropdownRef}>
        {/* Global Search Container */}
        <div className="relative w-48 sm:w-64 md:w-72" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit} className="relative">
            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                if (!isSearchOpen) setIsSearchOpen(true);
              }}
              onFocus={() => {
                setIsSearchOpen(true);
                loadSearchData();
              }}
              placeholder="Search WorkGrid..."
              className="w-full h-8.5 !pl-8 pr-12 text-xs bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/70 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 rounded-lg outline-none transition-all placeholder:text-slate-400"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden md:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 bg-slate-200/60 px-1.5 py-0.2 rounded font-mono border border-slate-300/50 pointer-events-none">
                /
              </kbd>
            )}
          </form>

          {/* Interactive Search Results Dropdown */}
          {isSearchOpen && (
            <div className="absolute left-0 mt-1.5 w-80 sm:w-96 max-h-[460px] bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col text-xs animate-fadeIn">
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {/* 1. Projects Section */}
                {matchingProjects.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Projects
                    </p>
                    <div className="space-y-0.5">
                      {matchingProjects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleSelectProject(p.id)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded bg-teal-50 text-[#0F766E] flex items-center justify-center shrink-0 border border-teal-200/60">
                              <FiFolder className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 truncate group-hover:text-[#0F766E]">
                                {p.name}
                              </p>
                              {p.description && (
                                <p className="text-[10px] text-slate-400 truncate">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 shrink-0">
                            {p.status || "active"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Tasks / Issues Section */}
                {matchingTasks.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Issues & Tasks
                    </p>
                    <div className="space-y-0.5">
                      {matchingTasks.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTask(t)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[10px] font-bold text-[#0F766E] bg-teal-50 border border-teal-200/80 px-1.5 py-0.2 rounded shrink-0">
                              {formatTaskKey(t, searchProjects)}
                            </span>
                            <p className="font-semibold text-slate-800 truncate group-hover:text-[#0F766E]">
                              {t.title}
                            </p>
                          </div>
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 shrink-0">
                            {t.status || "todo"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Team Members Section */}
                {matchingMembers.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      People
                    </p>
                    <div className="space-y-0.5">
                      {matchingMembers.map((m) => (
                        <button
                          key={m.id || m.user_id || m.email}
                          type="button"
                          onClick={() => handleSelectMember(m)}
                          className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {(m.full_name || m.name || m.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="font-semibold text-slate-800 truncate group-hover:text-[#0F766E]">
                                  {m.full_name || m.name || m.email}
                                </p>
                                {user?.id && (m.user_id === user.id || m.id === user.id || m.profiles?.id === user.id) && (
                                  <span className="text-[9px] font-semibold text-[#0F766E]">(You)</span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400 truncate font-mono">
                                {m.email}
                              </p>
                            </div>
                          </div>
                          <span className="text-[9px] font-semibold capitalize px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200/60 shrink-0">
                            {m.role || m.intended_role || "member"}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Quick Navigation Pages */}
                {matchingPages.length > 0 && (
                  <div className="p-2">
                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Navigation
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {matchingPages.map((page) => {
                        const Icon = page.icon;
                        return (
                          <button
                            key={page.href}
                            type="button"
                            onClick={() => handleSelectQuickLink(page.href)}
                            className="text-left p-2 rounded-md hover:bg-slate-50 flex items-center gap-2 transition-colors cursor-pointer group"
                          >
                            <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0F766E]" />
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-700 truncate group-hover:text-slate-900">
                                {page.title}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No Matches Found */}
                {!hasResults && trimmed && !isLoadingSearch && (
                  <div className="p-6 text-center space-y-1.5">
                    <p className="text-slate-700 font-semibold">No results found</p>
                    <p className="text-[11px] text-slate-400">
                      No projects, issues, or members matching &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Dropdown Footer Action */}
              <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="flex items-center gap-1.5 text-[#0F766E] hover:underline font-semibold cursor-pointer"
                >
                  <span>Search board for &ldquo;{searchQuery || "..."}&rdquo;</span>
                  <FiArrowRight className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-slate-400 font-mono">ESC to close</span>
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notifPanelRef}>
          <button
            onClick={() => {
              setNotificationsOpen((prev) => !prev);
              setDropdownOpen(false);
              // Load notifications when opening
              if (!notificationsOpen && orgId) {
                (async () => {
                  try {
                    const tasks = await taskService.getTasks({
                      organizationId: orgId,
                      userId: user?.id,
                      userRole,
                      userName: user?.full_name || user?.name || "",
                      userEmail: user?.email || "",
                      limit: 25,
                    });
                    const now = new Date();
                    const overdue = (tasks || []).filter((t) => {
                      if (!t.due_date || t.status === "done") return false;
                      return new Date(t.due_date) < now;
                    }).slice(0, 5);
                    const recentlyUpdated = (tasks || [])
                      .filter((t) => t.status !== "done" && t.updated_at)
                      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
                      .slice(0, 3);
                    const notifList = [
                      ...overdue.map((t) => ({
                        id: `overdue-${t.id}`,
                        type: "overdue",
                        title: t.title,
                        taskId: t.id,
                        dueDate: t.due_date,
                        priority: t.priority,
                      })),
                      ...recentlyUpdated.map((t) => ({
                        id: `updated-${t.id}`,
                        type: "updated",
                        title: t.title,
                        taskId: t.id,
                        updatedAt: t.updated_at,
                        status: t.status,
                      })),
                    ];
                    setNotifications(notifList);
                    setNotifUnreadCount(overdue.length);
                  } catch (_) {}
                })();
              }
            }}
            className="relative w-8.5 h-8.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Notifications (overdue tasks & activity)"
          >
            <FiBell className="w-4 h-4" />
            {notifUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                {notifUnreadCount > 9 ? "9+" : notifUnreadCount}
              </span>
            )}
            {notifUnreadCount === 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
            )}
          </button>

          {/* Notifications Panel */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden animate-fadeIn">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <FiBell className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-800">Notifications</span>
                  {notifUnreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 font-semibold">
                      {notifUnreadCount} overdue
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(false)}
                  className="p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center space-y-2">
                    <FiCheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">All caught up!</p>
                    <p className="text-[11px] text-slate-400">No overdue tasks or pending activity.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        router.push(`/issues/${n.taskId}`);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          n.type === "overdue" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                        }`}>
                          {n.type === "overdue" ? (
                            <FiAlertTriangle className="w-3 h-3" />
                          ) : (
                            <FiClock className="w-3 h-3" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#0F766E]">
                            {n.title}
                          </p>
                          <p className={`text-[10px] mt-0.5 font-medium ${
                            n.type === "overdue" ? "text-red-600" : "text-slate-500"
                          }`}>
                            {n.type === "overdue"
                              ? `⚠ Overdue since ${new Date(n.dueDate).toLocaleDateString()}`
                              : `Updated recently • ${n.status}`
                            }
                          </p>
                        </div>
                        <FiArrowRight className="w-3 h-3 text-slate-300 group-hover:text-[#0F766E] shrink-0 mt-1" />
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">Tasks assigned to you</span>
                <Link
                  href="/tasks"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[10px] font-semibold text-[#0F766E] hover:underline"
                >
                  View all tasks →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Settings button */}
        <Link
          href="/settings"
          className="w-8.5 h-8.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 hidden sm:flex items-center justify-center transition-colors cursor-pointer"
          title="Settings"
        >
          <FiSettings className="w-4 h-4" />
        </Link>

        {/* Help / Keyboard Shortcuts button */}
        <button
          type="button"
          onClick={() => setShowShortcutsModal(true)}
          className="w-8.5 h-8.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 hidden sm:flex items-center justify-center transition-colors cursor-pointer"
          title="Keyboard shortcuts & help (Press ?)"
        >
          <FiHelpCircle className="w-4 h-4" />
        </button>

        {/* User Profile Avatar & Menu */}
        <div className="relative ml-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-0.5 rounded-full hover:ring-2 hover:ring-[#0F766E]/30 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#0F766E] text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              {userInitials}
            </div>
          </button>

          {/* User Menu Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-slate-200 py-1.5 z-50 animate-fadeIn text-xs">
              {/* Profile Card */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-bold text-sm text-slate-900 truncate">
                  {userName}
                </p>
                <p className="text-slate-500 truncate text-[11px]">
                  {user?.email || "developer@workgrid.internal"}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 text-[#0F766E] font-medium text-[10px]">
                  <FiCheck className="w-3 h-3" />
                  {userRoleDisplay}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                >
                  <FiUser className="w-4 h-4 text-slate-400" />
                  <span>Profile & Settings</span>
                </Link>
              </div>

              {/* Logout Button */}
              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogoutClick}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Log out of WorkGrid</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
        user={user}
      />

      {/* Keyboard Shortcuts Help Modal */}
      {showShortcutsModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowShortcutsModal(false); }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md animate-scaleUp">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FiCommand className="w-4 h-4 text-[#0F766E]" />
                <h2 className="text-sm font-bold text-slate-900">Keyboard Shortcuts</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { category: "Navigation", shortcuts: [
                  { keys: ["/", "Ctrl+K"], desc: "Open global search" },
                  { keys: ["Esc"], desc: "Close search / modal" },
                ]},
                { category: "Tasks & Issues", shortcuts: [
                  { keys: ["G", "T"], desc: "Go to Tasks board" },
                  { keys: ["G", "P"], desc: "Go to Projects" },
                  { keys: ["G", "D"], desc: "Go to Dashboard" },
                ]},
                { category: "Interface", shortcuts: [
                  { keys: ["?"], desc: "Show this shortcuts panel" },
                ]},
              ].map((section) => (
                <div key={section.category}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{section.category}</p>
                  <div className="space-y-1.5">
                    {section.shortcuts.map((s, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">{s.desc}</span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((k, ki) => (
                            <span key={ki}>
                              <kbd className="text-[10px] bg-slate-100 border border-slate-300 text-slate-700 px-1.5 py-0.5 rounded font-mono shadow-sm">{k}</kbd>
                              {ki < s.keys.length - 1 && <span className="text-[10px] text-slate-400 mx-0.5">then</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <p className="text-[10px] text-slate-400 text-center">Press <kbd className="text-[10px] bg-slate-100 border border-slate-200 px-1 rounded font-mono">Esc</kbd> or click outside to close</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
