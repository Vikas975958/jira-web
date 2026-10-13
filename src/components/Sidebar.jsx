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
    completed: "bg-teal-50 text-[#0F766E] border-teal-200",
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
          {/* Active Workspace Header */}
          {activeOrg && (
            <div className="px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#0F766E] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {activeOrg.name?.charAt(0)?.toUpperCase() || "W"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {activeOrg.name}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium capitalize truncate">
                    {userRole === OWNER_ROLE ? "Workspace Owner" : userRole}
                  </p>
                </div>
              </div>

              {userRole === OWNER_ROLE && (
                <Link
                  href="/dashboard/create-organization"
                  className="p-1 rounded-lg text-slate-400 hover:text-[#0F766E] hover:bg-slate-200/50 transition-colors"
                  title="Create New Organization"
                >
                  <LuPlus className="w-4 h-4" />
                </Link>
              )}
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
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Show alternate workspaces only when user belongs to multiple organizations */}
          {organizations && organizations.length > 1 && (
            <div className="space-y-1.5">
              <div className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
                <span>Other Workspaces</span>
              </div>
              <div className="space-y-0.5">
                {organizations
                  .filter((orgItem) => {
                    const orgData = orgItem.organizations || orgItem;
                    return orgData?.id !== activeOrg?.id;
                  })
                  .map((orgItem) => {
                    const orgData = orgItem.organizations || orgItem;
                    return (
                      <Link
                        key={orgData.id}
                        href="/dashboard"
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold text-[#0F766E]">
                            {orgData.name?.charAt(0)?.toUpperCase() || "O"}
                          </div>
                          <span className="truncate text-xs">{orgData.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize shrink-0 ml-1">
                          {orgItem.role || MEMBER_ROLE}
                        </span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ALL PROJECTS Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              <div className="flex items-center gap-1.5">
                <span>Projects</span>
                {projects.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                    {projects.length}
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

            <div className="space-y-0.5">
              {loadingProjects ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-300 border-t-[#0F766E] animate-spin" />
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? "bg-slate-100 text-slate-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-50 font-normal"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isCurrent
                              ? "bg-[#0F766E] text-white"
                              : "bg-teal-50 border border-teal-200/80 text-[#0F766E]"
                          }`}
                        >
                          <LuFolder className="w-3 h-3" />
                        </div>
                        <span className="truncate text-xs">{project.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-lg font-bold uppercase tracking-wider border ${
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
