"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import {
  LuFolder,
  LuUsers,
  LuLayoutGrid,
  LuSlidersVertical,
  LuPlus,
} from "react-icons/lu";
import { useOrganization } from "@/context/OrganizationContext";
import projectService from "@/services/project.service";
import CreateProjectModal from "@/components/CreateProjectModal";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, members: realMembers = [] } = useOrganization();

  const activeOrg = currentOrg?.organizations || currentOrg || organizations?.[0]?.organizations || organizations?.[0];
  const userRole = currentOrg?.role || organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;

  // Projects state
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);

  const mainNav = [
    {
      name: "Dashboard",
      icon: LuLayoutGrid,
      path: "/dashboard",
    },
    {
      name: "Projects",
      icon: LuFolder,
      path: "/projects",
    },
    {
      name: "Team",
      icon: LuUsers,
      path: "/team",
      count: realMembers.length,
    },
    {
      name: "Settings",
      icon: LuSlidersVertical,
      path: "/settings",
    },
  ];

  const projectStatusBadge = {
    planning: "bg-slate-100 text-slate-700 border-slate-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    on_hold: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    archived: "bg-slate-100 text-slate-500 border-slate-200",
  };

  // Load projects for active workspace
  const loadProjects = useCallback(async () => {
    const orgId = activeOrg?.id;
    if (!orgId) {
      setProjects([]);
      return;
    }

    try {
      setLoadingProjects(true);
      const data = await projectService.getProjects({
        organizationId: orgId,
        userId: user?.id,
        userRole,
      });
      setProjects(data || []);
    } catch (err) {
      console.error("Sidebar loadProjects error:", err);
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  }, [activeOrg?.id, user?.id, userRole]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Synchronize projects across pages and custom events
  useEffect(() => {
    const handleSync = () => loadProjects();
    window.addEventListener("project-created", handleSync);
    window.addEventListener("project-updated", handleSync);
    window.addEventListener("project-deleted", handleSync);
    return () => {
      window.removeEventListener("project-created", handleSync);
      window.removeEventListener("project-updated", handleSync);
      window.removeEventListener("project-deleted", handleSync);
    };
  }, [loadProjects]);



  return (
    <>
      <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between select-none shrink-0 h-full overflow-y-auto">
        <div className="p-3 space-y-5">
          {/* Active Workspace Pill */}
          {activeOrg && (
            <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                {activeOrg.name?.charAt(0)?.toUpperCase() || "W"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {activeOrg.name}
                </p>
                {userRole === OWNER_ROLE ? (
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    org/{activeOrg.slug || "workspace"}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 capitalize truncate font-medium">
                    Role: {userRole}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Top Main Navigation */}
          <nav className="space-y-0.5">
            {mainNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;

              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                    isActive
                      ? "bg-slate-100 text-slate-900 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-slate-900" : "text-slate-500"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-semibold">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* WORKSPACES / ORGANIZATIONS Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              <span>Workspaces</span>
              <Link
                href="/dashboard/create-organization"
                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                title="Create Organization"
              >
                <LuPlus className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-0.5">
              {organizations && organizations.length > 0 ? (
                organizations.map((orgItem) => {
                  const orgData = orgItem.organizations || orgItem;
                  const isCurrent = orgData?.id === activeOrg?.id;

                  return (
                    <Link
                      key={orgData.id}
                      href="/dashboard"
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-normal"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-5 h-5 rounded-md bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs text-[10px] font-bold text-blue-600">
                          {orgData.name?.charAt(0)?.toUpperCase() || "O"}
                        </div>
                        <span className="truncate text-xs">{orgData.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                        {orgItem.role || MEMBER_ROLE}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-[11px] text-slate-400">
                  No organization created yet.
                </div>
              )}
            </div>
          </div>

          {/* ALL PROJECTS Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              <div className="flex items-center gap-1.5">
                <span>Projects</span>
                {projects.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600 font-semibold">
                    {projects.length}
                  </span>
                )}
              </div>
              {!isMember && (
                <button
                  type="button"
                  onClick={() => setIsCreateProjectModalOpen(true)}
                  className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                  title="Create Project"
                >
                  <LuPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-0.5">
              {loadingProjects ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
                  <span>Loading projects...</span>
                </div>
              ) : projects && projects.length > 0 ? (
                projects.map((project) => {
                  const totalTeam =
                    project.totalTeamCount ??
                    ((project.assignedManagers?.length || 0) +
                      (project.assignedMembers?.length || 0) ||
                      project.project_members?.length ||
                      0);

                  const isCurrent = pathname === `/projects/${project.id}`;

                  return (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-normal"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 border border-blue-200/80 text-blue-600"
                          }`}
                        >
                          <LuFolder className="w-3 h-3" />
                        </div>
                        <span className="truncate text-xs">{project.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider border ${
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
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-[11px] text-slate-400">
                  No projects created yet.
                </div>
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
