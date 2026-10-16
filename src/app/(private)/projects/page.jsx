"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  Suspense,
} from "react";
import { useSelector } from "react-redux";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FiPlus,
  FiSearch,
  FiX,
  FiFolder,
  FiCalendar,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
  FiLayers,
} from "react-icons/fi";
import projectService from "@/services/project.service";
import CreateProjectModal from "@/components/CreateProjectModal";
import { useOrganization } from "@/context/OrganizationContext";
import { MEMBER_ROLE, OWNER_ROLE, MANAGER_ROLE } from "@/utils/constants";

function ProjectsDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("search") || "";

  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const {
    currentOrg,
    organizations,
    members = [],
    loadingOrgs,
  } = useOrganization();

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

  const [projects, setProjects] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  const [searchInput, setSearchInput] = useState(initialSearch);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Sync initialSearch if URL query changes
  useEffect(() => {
    if (initialSearch !== searchInput) {
      setSearchInput(initialSearch);
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Load paginated projects from Supabase
  const loadPaginatedProjects = useCallback(async () => {
    const orgId = activeOrg?.id;
    if (!orgId) {
      if (!loadingOrgs) setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await projectService.getProjectsPaginated({
        organizationId: orgId,
        userId: user?.id,
        userRole,
        page,
        pageSize,
        search: searchQuery,
        status: statusFilter,
      });

      setProjects(res.projects || []);
      setTotalCount(res.totalCount || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error("Failed to load paginated projects:", err);
      setProjects([]);
      setTotalCount(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [
    activeOrg?.id,
    user?.id,
    userRole,
    page,
    pageSize,
    searchQuery,
    statusFilter,
    loadingOrgs,
  ]);

  useEffect(() => {
    loadPaginatedProjects();
  }, [loadPaginatedProjects]);

  // Listen for created or deleted projects to reload
  useEffect(() => {
    const handleProjectChange = () => {
      loadPaginatedProjects();
    };
    window.addEventListener("project-created", handleProjectChange);
    window.addEventListener("project-deleted", handleProjectChange);
    return () => {
      window.removeEventListener("project-created", handleProjectChange);
      window.removeEventListener("project-deleted", handleProjectChange);
    };
  }, [loadPaginatedProjects]);

  const handleProjectClick = (proj) => {
    if (!proj?.id) return;
    router.push(`/projects/${proj.id}`);
  };

  const handleOpenBoard = (e, projId) => {
    e.stopPropagation();
    if (!projId) return;
    router.push(`/tasks?projectId=${projId}`);
  };

  const projectStatusBadge = {
    planning: "bg-slate-100 text-slate-700 border-slate-200",
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    on_hold: "bg-amber-50 text-amber-700 border-amber-200",
    completed: "bg-teal-50 text-[#0F766E] border-teal-200",
    archived: "bg-slate-100 text-slate-500 border-slate-200",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-7 space-y-5 max-w-[1680px] mx-auto select-none">
      {/* ─────────────────────────────────────────────────── */}
      {/* Page Header                                        */}
      {/* ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Projects
            </h1>
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
            {!loading && totalCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold border border-slate-200">
                {totalCount} {totalCount === 1 ? "project" : "projects"}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {activeOrg?.name
              ? `Browse and manage projects for ${activeOrg.name}`
              : "Manage and track all projects in your workspace"}
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:w-64">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search projects by name..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 rounded-lg outline-none transition-all placeholder:text-slate-400"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                title="Clear search"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 text-xs bg-white border border-slate-200 hover:border-slate-300 focus:border-[#0F766E] focus:ring-2 focus:ring-[#0F766E]/15 rounded-lg outline-none transition-all text-slate-700 font-medium cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="planning">Planning</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          {/* Create Project Button (Owner & Manager) */}
          {(isOwner || isManager) && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="btn-primary px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer flex items-center gap-1.5"
            >
              <FiPlus className="w-3.5 h-3.5" />
              <span>Create Project</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────── */}
      {/* Project Cards Grid / Loading / Empty States        */}
      {/* ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5 animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-200" />
                  <div className="space-y-1.5">
                    <div className="h-4 bg-slate-200 rounded w-28" />
                    <div className="h-3 bg-slate-100 rounded w-16" />
                  </div>
                </div>
                <div className="h-5 w-16 bg-slate-200 rounded-md" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 bg-slate-100 rounded w-full" />
                <div className="h-3 bg-slate-100 rounded w-3/4" />
              </div>
              <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                <div className="h-4 bg-slate-100 rounded w-20" />
                <div className="h-4 bg-slate-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-xl bg-teal-50 text-[#0F766E] flex items-center justify-center mx-auto">
            <FiFolder className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {searchQuery || statusFilter !== "all"
                ? "No Matching Projects"
                : "No Projects Created Yet"}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {searchQuery || statusFilter !== "all"
                ? "No projects matched your search criteria. Try clearing filters or using a different keyword."
                : "Create your first project to start organizing team tasks, issues, and tracking agile sprints."}
            </p>
          </div>
          {searchQuery || statusFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setSearchQuery("");
                setStatusFilter("all");
                setPage(1);
              }}
              className="btn-secondary px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              <span>Clear Filters</span>
            </button>
          ) : (
            (isOwner || isManager) && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="btn-primary px-4 py-2 text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                <FiPlus className="w-3.5 h-3.5" />
                <span>Create Project</span>
              </button>
            )
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
            {projects.map((proj) => {
              const totalTeam =
                proj.totalTeamCount ??
                ((proj.assignedManagers?.length || 0) +
                  (proj.assignedMembers?.length || 0) ||
                  proj.project_members?.length ||
                  0);
              const allMembers = [
                ...(proj.assignedManagers || []),
                ...(proj.assignedMembers || []),
              ];

              return (
                <div
                  key={proj.id}
                  onClick={() => handleProjectClick(proj)}
                  className="bg-white rounded-xl border border-slate-200/90 hover:border-[#0F766E]/50 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between cursor-pointer group select-none relative"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200/70 text-[#0F766E] font-bold text-sm flex items-center justify-center shrink-0 group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
                          {proj.name?.charAt(0)?.toUpperCase() || "P"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0F766E] transition-colors truncate">
                            {proj.name}
                          </h3>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Created{" "}
                            {proj.created_at
                              ? new Date(proj.created_at).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )
                              : "Recently"}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider shrink-0 border ${
                          projectStatusBadge[proj.status] ||
                          projectStatusBadge.active
                        }`}
                      >
                        {(proj.status || "active").replace("_", " ")}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 mt-3 leading-relaxed min-h-[36px]">
                      {proj.description || "No description provided."}
                    </p>

                    {(proj.start_date || proj.due_date) && (
                      <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
                        {proj.start_date && (
                          <div
                            className="flex items-center gap-1.5"
                            title="Start date"
                          >
                            <FiCalendar className="w-3 h-3 text-slate-400" />
                            <span>
                              {new Date(proj.start_date).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          </div>
                        )}
                        {proj.due_date && (
                          <div
                            className="flex items-center gap-1.5"
                            title="Due date"
                          >
                            <FiClock className="w-3 h-3 text-amber-500" />
                            <span>
                              {new Date(proj.due_date).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" },
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {totalTeam > 0 ? (
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
                          {allMembers.slice(0, 3).map((m, idx) => (
                            <div
                              key={m.id || idx}
                              className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white text-slate-700 font-bold text-[9px] flex items-center justify-center shrink-0"
                              title={m.fullName || m.name || m.email}
                            >
                              {(m.fullName || m.name || "U")
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          ))}
                          {totalTeam > 3 && (
                            <span className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white text-slate-600 font-bold text-[9px] flex items-center justify-center shrink-0">
                              +{totalTeam - 3}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-500 ml-2 font-medium truncate">
                            {totalTeam} {totalTeam === 1 ? "member" : "members"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">
                          No assigned team
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={(e) => handleOpenBoard(e, proj.id)}
                        className="px-2.5 py-1 text-[11px] font-bold text-[#0F766E] bg-teal-50 hover:bg-[#0F766E] hover:text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 border border-teal-200/60"
                        title="Open Tasks Kanban Board"
                      >
                        <FiLayers className="w-3 h-3" />
                        <span>Tasks Board</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─────────────────────────────────────────────────── */}
          {/* Pagination Controls                                */}
          {/* ─────────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200/80 bg-white p-3 rounded-xl border">
              <p className="text-xs text-slate-500 font-medium">
                Showing{" "}
                <span className="font-semibold text-slate-800">
                  {(page - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-slate-800">
                  {Math.min(page * pageSize, totalCount)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-slate-800">{totalCount}</span>{" "}
                projects
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-medium transition-colors flex items-center gap-1"
                  title="Previous page"
                >
                  <FiChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {[...Array(totalPages)].map((_, idx) => {
                    const pageNum = idx + 1;
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= page - 1 && pageNum <= page + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPage(pageNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            page === pageNum
                              ? "bg-[#0F766E] text-white shadow-2xs"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === page - 2 || pageNum === page + 2) {
                      return (
                        <span key={pageNum} className="text-slate-400 text-xs px-0.5">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-xs font-medium transition-colors flex items-center gap-1"
                  title="Next page"
                >
                  <span>Next</span>
                  <FiChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          organizationId={activeOrg?.id}
          organizationName={activeOrg?.name}
          currentUserRole={userRole}
          currentUserId={user?.id}
          existingMembers={members}
          onProjectCreated={(newProject) => {
            setIsCreateModalOpen(false);
            loadPaginatedProjects();
            if (typeof window !== "undefined") {
              window.dispatchEvent(
                new CustomEvent("project-created", { detail: newProject })
              );
            }
          }}
        />
      )}
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
      <ProjectsDirectoryContent />
    </Suspense>
  );
}
