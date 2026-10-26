"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import {
  LuFolder,
  LuUsers,
  LuLayoutGrid,
  LuPlus,
  LuChevronLeft,
  LuChevronRight,
  LuX,
  LuKanban,
  LuPin,
} from "react-icons/lu";
import { useOrganization } from "@/context/OrganizationContext";
import { useSidebar } from "@/context/SidebarContext";
import projectService from "@/services/project.service";
import CreateProjectModal from "@/components/CreateProjectModal";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";
import { getPinnedProjectIds, unpinProject } from "@/utils/pinnedProjects";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryProjectId = searchParams?.get("projectId");
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, members: realMembers = [] } = useOrganization();
  const { isCollapsed, toggleSidebar, isMobileOpen, closeMobile } = useSidebar();

  const activeOrg = currentOrg?.organizations || currentOrg || organizations?.[0]?.organizations || organizations?.[0];
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;

  const [allProjects, setAllProjects] = useState([]);
  const [pinnedIds, setPinnedIds] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  const mainNav = [
    {
      name: "Dashboard",
      icon: LuLayoutGrid,
      path: "/dashboard",
    },
    {
      name: "Tasks",
      icon: LuKanban,
      path: "/tasks",
    },
    {
      name: "Team",
      icon: LuUsers,
      path: "/team",
      count: realMembers.length,
    },
  ];

  const projectStatusBadge = {
    planning: "bg-slate-100 text-slate-700 border-slate-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    on_hold: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-teal-50 text-[#0F766E] border-teal-200",
    archived: "bg-slate-100 text-slate-500 border-slate-200",
  };

  const lastFetchedOrgIdRef = useRef(null);
  const allProjectsRef = useRef(allProjects);

  useEffect(() => {
    allProjectsRef.current = allProjects;
  }, [allProjects]);

  // Sync pinnedIds whenever activeOrg or user changes
  useEffect(() => {
    if (activeOrg?.id) {
      setPinnedIds(getPinnedProjectIds(activeOrg.id, user?.id));
    } else {
      setPinnedIds([]);
    }
  }, [activeOrg?.id, user?.id]);

  // Listen for pinned project updates across the app and across browser tabs
  useEffect(() => {
    const handlePinnedChange = () => {
      if (activeOrg?.id) {
        setPinnedIds(getPinnedProjectIds(activeOrg.id, user?.id));
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("project-pinned-updated", handlePinnedChange);
      window.addEventListener("storage", handlePinnedChange);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("project-pinned-updated", handlePinnedChange);
        window.removeEventListener("storage", handlePinnedChange);
      }
    };
  }, [activeOrg?.id, user?.id]);

  // Load all projects for active workspace
  const loadProjects = useCallback(async (force = false) => {
    const orgId = activeOrg?.id;
    if (!orgId) {
      setAllProjects([]);
      lastFetchedOrgIdRef.current = null;
      return;
    }

    if (!force && lastFetchedOrgIdRef.current === orgId && allProjectsRef.current.length > 0) {
      return;
    }

    try {
      setLoadingProjects(true);
      const data = await projectService.getProjects({
        organizationId: orgId,
        userId: user?.id,
        userRole,
        force,
      });
      lastFetchedOrgIdRef.current = orgId;
      setAllProjects(data || []);
    } catch (err) {
      console.error("Sidebar loadProjects error:", err);
      setAllProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [activeOrg?.id, user?.id, userRole]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const handleProjectCreated = () => loadProjects(true);
    const handleProjectDeleted = () => loadProjects(true);
    const handleProjectUpdated = () => loadProjects(true);

    if (typeof window !== "undefined") {
      window.addEventListener("project-created", handleProjectCreated);
      window.addEventListener("project-deleted", handleProjectDeleted);
      window.addEventListener("project-updated", handleProjectUpdated);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("project-created", handleProjectCreated);
        window.removeEventListener("project-deleted", handleProjectDeleted);
        window.removeEventListener("project-updated", handleProjectUpdated);
      }
    };
  }, [loadProjects]);

  // Only pinned projects are displayed in the sidebar
  const pinnedProjects = React.useMemo(() => {
    if (!pinnedIds || pinnedIds.length === 0) return [];
    const projectMap = new Map((allProjects || []).map((p) => [p.id, p]));
    return pinnedIds.map((id) => projectMap.get(id)).filter(Boolean);
  }, [allProjects, pinnedIds]);

  return (
    <>
      <aside
        className={`relative border-r border-slate-200/80 bg-white flex flex-col justify-between select-none shrink-0 h-full ${
          isCollapsed ? "overflow-visible" : "overflow-hidden"
        } transition-all duration-200 ease-in-out z-40
          ${isCollapsed ? "w-16" : "w-60 lg:w-64"}
          ${
            isMobileOpen
              ? "fixed inset-y-0 left-0 shadow-2xl translate-x-0 w-64 flex"
              : "hidden md:flex"
          }
        `}
      >
        <div className={`p-3 space-y-4 flex-1 ${isCollapsed ? "overflow-visible" : "overflow-y-auto"}`}>
          {/* Active Workspace Header */}
          {activeOrg && (
            <div
              className={`rounded-lg bg-slate-50 border border-slate-200/70 flex items-center transition-all ${
                isCollapsed ? "p-1.5 justify-center" : "px-2.5 py-2 justify-between gap-2"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-lg bg-[#0F766E] text-white font-bold text-xs flex items-center justify-center shrink-0 cursor-pointer relative group"
                  title={`${activeOrg.name} (${userRole === OWNER_ROLE ? "Workspace Owner" : userRole})`}
                  onClick={() => isCollapsed && toggleSidebar()}
                >
                  {activeOrg.name?.charAt(0)?.toUpperCase() || "W"}

                  {/* Tooltip for Workspace */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 flex items-center z-50 drop-shadow-xl">
                      <div className="w-2 h-2 bg-slate-900 rotate-45 -mr-1 shrink-0 z-10" />
                      <div className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap border border-slate-700/60 shadow-xl">
                        <span className="font-semibold text-slate-100">{activeOrg.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 font-medium uppercase tracking-wider border border-slate-700/50">
                          {userRole === OWNER_ROLE ? "Workspace Owner" : userRole}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {activeOrg.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium capitalize truncate">
                      {userRole === OWNER_ROLE ? "Workspace Owner" : userRole}
                    </p>
                  </div>
                )}
              </div>

              {/* Desktop Collapse Button */}
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="hidden md:flex text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                  title="Collapse sidebar"
                >
                  <LuChevronLeft className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={closeMobile}
                className="md:hidden text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                title="Close sidebar"
              >
                <LuX className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Top Main Navigation */}
          <nav className="space-y-0.5">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.path ||
                (item.path === "/tasks" && pathname?.startsWith("/tasks"));

              if (isCollapsed) {
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => closeMobile()}
                    title={item.name}
                    className={`w-full flex items-center justify-center p-2 rounded-lg text-xs transition-colors relative group cursor-pointer ${
                      isActive
                        ? "bg-teal-50 text-[#0F766E] font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`w-4.5 h-4.5 ${
                        isActive ? "text-[#0F766E]" : "text-slate-500"
                      }`}
                    />
                    {item.count !== undefined && item.count > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#0F766E]" />
                    )}

                    {/* Tooltip for Main Nav Item */}
                    <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 flex items-center z-50 drop-shadow-xl">
                      <div className="w-2 h-2 bg-slate-900 rotate-45 -mr-1 shrink-0 z-10" />
                      <div className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap border border-slate-700/60 shadow-xl">
                        <span className="font-semibold text-slate-100">{item.name}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0F766E] text-white font-bold">
                            {item.count}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  onClick={() => closeMobile()}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-[#0F766E]" : "text-slate-400"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* PROJECTS Section - Only shows pinned projects */}
          <div className="space-y-1">
            {!isCollapsed ? (
              <div className="flex items-center justify-between px-3 py-1 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                <div className="flex items-center gap-1.5" title="Pinned projects displayed in sidebar">
                  <span>Projects</span>
                  {pinnedProjects.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-teal-50 text-[#0F766E] font-semibold border border-teal-200/60">
                      {pinnedProjects.length}
                    </span>
                  )}
                </div>
                {!isMember && (
                  <button
                    type="button"
                    onClick={() => setIsCreateProjectModalOpen(true)}
                    className="text-slate-400 hover:text-[#0F766E] p-0.5 rounded-lg transition-colors cursor-pointer"
                    title="Create Project"
                  >
                    <LuPlus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 flex justify-center" title="Pinned Projects">
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest">
                  Projects
                </span>
              </div>
            )}

            <div className="space-y-0.5">
              {loadingProjects ? (
                <div className={`py-2 text-[11px] text-slate-400 flex items-center ${isCollapsed ? "justify-center" : "px-3 gap-2"}`}>
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 border-t-[#0F766E] animate-spin" />
                  {!isCollapsed && <span>Loading projects...</span>}
                </div>
              ) : pinnedProjects && pinnedProjects.length > 0 ? (
                pinnedProjects.map((project) => {
                  const totalTeam =
                    project.totalTeamCount ??
                    ((project.assignedManagers?.length || 0) +
                      (project.assignedMembers?.length || 0) ||
                      project.project_members?.length ||
                      0);

                  const isCurrent = pathname === `/projects/${project.id}`;
                  const initial = (project.name || "P").trim().charAt(0).toUpperCase();

                  if (isCollapsed) {
                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        onClick={() => {
                          closeMobile();
                        }}
                        title={`${project.name} (${project.status || "active"}) • Pinned`}
                        className="w-full flex items-center justify-center p-1 rounded-lg transition-colors cursor-pointer relative group"
                      >
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center uppercase transition-all shadow-2xs ${
                            isCurrent
                              ? "bg-[#0F766E] text-white shadow-xs ring-2 ring-teal-600/25 ring-offset-1"
                              : "bg-slate-100 text-slate-600 border border-slate-200/80 group-hover:bg-teal-50 group-hover:text-[#0F766E] group-hover:border-teal-200"
                          }`}
                        >
                          {initial}
                        </span>

                        {/* Floating Tooltip showing complete project name */}
                        <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 flex items-center z-50 drop-shadow-xl">
                          <div className="w-2 h-2 bg-slate-900 rotate-45 -mr-1 shrink-0 z-10" />
                          <div className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap border border-slate-700/60 shadow-xl">
                            <span className="font-semibold text-slate-100">{project.name}</span>
                            {project.status && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-teal-300 font-medium uppercase tracking-wider border border-slate-700/50">
                                {(project.status || "active").replace("_", " ")}
                              </span>
                            )}
                            <span className="text-[10px] text-teal-300 flex items-center gap-0.5">
                              <LuPin className="w-2.5 h-2.5 fill-current" />
                              Pinned
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      onClick={() => {
                        closeMobile();
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group ${
                        isCurrent
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-normal"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? "bg-[#0F766E] text-white"
                              : "bg-teal-50 text-[#0F766E]"
                          }`}
                        >
                          <LuFolder className="w-3 h-3" />
                        </div>
                        <span className="truncate text-xs">{project.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-md font-semibold uppercase tracking-wider ${
                            projectStatusBadge[project.status] ||
                            projectStatusBadge.active
                          }`}
                        >
                          {project.status || "active"}
                        </span>
                        {totalTeam > 0 && (
                          <span
                            className="text-[10px] text-slate-400 font-mono"
                            title={`${totalTeam} assigned members`}
                          >
                            {totalTeam}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            unpinProject(activeOrg?.id, user?.id, project.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-500 rounded transition-all cursor-pointer"
                          title="Unpin from sidebar"
                        >
                          <LuPin className="w-3 h-3 fill-current rotate-45" />
                        </button>
                      </div>
                    </Link>
                  );
                })
              ) : (
                !isCollapsed && (
                  <div className="px-3 py-2 text-[11px] text-slate-400 space-y-1 bg-slate-50/70 rounded-lg mx-1 my-0.5 border border-dashed border-slate-200">
                    <div className="flex items-center gap-1.5 font-medium text-slate-600">
                      <LuPin className="w-3 h-3 text-slate-400" />
                      <span>No pinned projects</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Pin projects from the list to display them in this sidebar.
                    </p>
                    <Link
                      href="/projects"
                      onClick={() => closeMobile()}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] hover:underline pt-0.5 cursor-pointer"
                    >
                      <span>Browse projects</span>
                      <LuChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                )
              )}

              {/* View All Projects Option */}
              {isCollapsed ? (
                <Link
                  href="/projects"
                  onClick={() => closeMobile()}
                  title="View All Projects"
                  className="w-full flex items-center justify-center p-1 rounded-lg transition-colors cursor-pointer relative group pt-1.5 border-t border-slate-100 mt-1"
                >
                  <span
                    className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center uppercase transition-all shadow-2xs ${
                      pathname === "/projects" && !queryProjectId
                        ? "bg-[#0F766E] text-white shadow-xs ring-2 ring-teal-600/25 ring-offset-1"
                        : "bg-slate-100 text-slate-600 border border-slate-200/80 group-hover:bg-teal-50 group-hover:text-[#0F766E] group-hover:border-teal-200"
                    }`}
                  >
                    <LuLayoutGrid className="w-3.5 h-3.5" />
                  </span>

                  {/* Floating Tooltip */}
                  <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 flex items-center z-50 drop-shadow-xl">
                    <div className="w-2 h-2 bg-slate-900 rotate-45 -mr-1 shrink-0 z-10" />
                    <div className="bg-slate-900 text-white text-xs px-2.5 py-1.5 rounded-md flex items-center gap-2 whitespace-nowrap border border-slate-700/60 shadow-xl">
                      <span className="font-semibold text-slate-100">View All Projects</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/projects"
                  onClick={() => closeMobile()}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer group pt-1.5 border-t border-slate-100 mt-1 ${
                    pathname === "/projects" && !queryProjectId
                      ? "bg-slate-100 text-[#0F766E] font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        pathname === "/projects" && !queryProjectId
                          ? "bg-[#0F766E] text-white"
                          : "bg-teal-50/70 text-[#0F766E] group-hover:bg-[#0F766E] group-hover:text-white"
                      }`}
                    >
                      <LuLayoutGrid className="w-3 h-3" />
                    </div>
                    <span className="truncate text-xs">View All Projects</span>
                  </div>
                  <LuChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Create Project Modal */}
      {isCreateProjectModalOpen && (
        <CreateProjectModal
          isOpen={isCreateProjectModalOpen}
          onClose={() => setIsCreateProjectModalOpen(false)}
          organizationId={activeOrg?.id}
          organizationName={activeOrg?.name}
          currentUserId={user?.id}
          currentUserRole={userRole}
          existingMembers={realMembers}
          onProjectCreated={(newProject) => {
            loadProjects();
            setIsCreateProjectModalOpen(false);
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("project-created", { detail: newProject })
              );
            }
          }}
        />
      )}
    </>
  );
}


