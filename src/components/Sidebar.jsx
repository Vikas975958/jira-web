"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import {
  LuFolder,
  LuUsers,
  LuLayoutGrid,
  LuSlidersVertical,
  LuPlus,
} from "react-icons/lu";
import organizationService from "@/services/organization.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function Sidebar() {
  const pathname = usePathname();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [organizations, setOrganizations] = useState([]);
  const [realMembers, setRealMembers] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchOrgs = async () => {
      if (!user?.id) {
        setOrganizations([]);
        setRealMembers([]);
        return;
      }
      try {
        const orgs = await organizationService.getUserOrganizations(user.id);
        if (isMounted) {
          setOrganizations(orgs || []);
          if (orgs && orgs.length > 0) {
            const orgId = orgs[0]?.organizations?.id || orgs[0]?.id;
            const currentRole = orgs[0]?.role || user?.role || MEMBER_ROLE;
            if (orgId) {
              if (currentRole === MEMBER_ROLE) {
                if (isMounted) setRealMembers([]);
              } else {
                const members = await organizationService.getOrganizationMembers(orgId, {
                  currentUserId: user.id,
                  currentUserRole: currentRole,
                });
                if (isMounted) setRealMembers(members || []);
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to load sidebar data:", err);
      }
    };

    fetchOrgs();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role]);

  const activeOrg = organizations?.[0]?.organizations || organizations?.[0];
  const userRole = organizations?.[0]?.role || user?.role || MEMBER_ROLE;
  const isMember = userRole === MEMBER_ROLE;

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

  const roleColors = {
    owner: "bg-amber-100 text-amber-700",
    manager: "bg-purple-100 text-purple-700",
    member: "bg-blue-100 text-blue-700",
  };

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between select-none shrink-0 overflow-y-auto">
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

        {/* REAL TEAM MEMBERS Section - Visible to Owner and Manager only */}
        {!isMember && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
              <span>Team Members</span>
              <Link
                href="/team"
                className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition-colors cursor-pointer"
                title="Manage team"
              >
                <LuPlus className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="space-y-0.5">
              {realMembers && realMembers.length > 0 ? (
                realMembers.map((member) => {
                  const profile = member.profiles;
                  const memberName =
                    userRole === MANAGER_ROLE && member.role === OWNER_ROLE
                      ? "Workspace Owner"
                      : profile?.full_name || profile?.email?.split("@")[0] || "Member";
                  const initials = memberName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "U";

                  return (
                    <div
                      key={member.id}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className={`w-6 h-6 rounded-full ${roleColors[member.role] || "bg-slate-100 text-slate-600"} text-[10px] font-bold flex items-center justify-center`}>
                            {initials}
                          </div>
                        </div>
                        <span className="truncate text-xs font-medium text-slate-800">
                          {memberName}
                        </span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 capitalize shrink-0 ml-2">
                        {member.role}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-[11px] text-slate-400">
                  No members joined yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
