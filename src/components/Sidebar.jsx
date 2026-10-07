"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LuFolder,
  LuUsers,
  LuLayoutGrid,
  LuSlidersVertical,
  LuPlus,
} from "react-icons/lu";

export default function Sidebar() {
  const pathname = usePathname();
  const [selectedProject, setSelectedProject] = useState("ATL");

  const mainNav = [
    {
      name: "Projects",
      icon: LuFolder,
      path: "/projects",
      count: 10,
    },
    {
      name: "Team",
      icon: LuUsers,
      path: "/team",
      count: 6,
    },
    {
      name: "Dashboard",
      icon: LuLayoutGrid,
      path: "/dashboard",
    },
    {
      name: "Settings",
      icon: LuSlidersVertical,
      path: "/settings",
    },
  ];

  const projects = [
    {
      id: "ATL",
      name: "Atlas Web App",
      code: "ATL",
      color: "bg-blue-600",
      path: "/projects",
    },
    {
      id: "MOB",
      name: "Mobile Onboarding",
      code: "MOB",
      color: "bg-emerald-500",
      path: "/projects",
    },
    {
      id: "BIL",
      name: "Billing Revamp",
      code: "BIL",
      color: "bg-amber-500",
      path: "/projects",
    },
  ];

  const teamMembers = [
    {
      name: "Nora Okafor",
      initials: "NO",
      bgColor: "bg-blue-100 text-blue-700",
      status: "Online",
      statusColor: "bg-emerald-500",
    },
    {
      name: "Maya Chen",
      initials: "MC",
      bgColor: "bg-orange-100 text-orange-700",
      status: "Online",
      statusColor: "bg-emerald-500",
    },
    {
      name: "Leo Park",
      initials: "LP",
      bgColor: "bg-emerald-100 text-emerald-700",
      status: "Away",
      statusColor: "bg-amber-400",
    },
    {
      name: "Ana Ruiz",
      initials: "AR",
      bgColor: "bg-pink-100 text-pink-700",
      status: "Online",
      statusColor: "bg-emerald-500",
    },
    {
      name: "Kofi Mensah",
      initials: "KM",
      bgColor: "bg-purple-100 text-purple-700",
      status: "Offline",
      statusColor: "bg-slate-300",
    },
    {
      name: "Ines Duarte",
      initials: "ID",
      bgColor: "bg-amber-100 text-amber-700",
      status: "Away",
      statusColor: "bg-amber-400",
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between select-none shrink-0 overflow-y-auto">
      <div className="p-3 space-y-6">
        {/* Top Main Navigation */}
        <nav className="space-y-1">
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
                {item.count !== undefined && (
                  <span className="text-xs text-slate-400 font-normal">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* PROJECTS Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            <span>Projects</span>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors cursor-pointer"
              title="Add project"
            >
              <LuPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {projects.map((project) => {
              const isSelected = selectedProject === project.id;

              return (
                <Link
                  key={project.id}
                  href={project.path}
                  onClick={() => setSelectedProject(project.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-100 text-slate-900 font-medium"
                      : "text-slate-700 hover:bg-slate-50 font-normal"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-5 h-5 rounded-md bg-white border border-slate-200/80 flex items-center justify-center shrink-0 shadow-2xs">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${project.color}`}
                      />
                    </div>
                    <span className="truncate text-xs">{project.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider shrink-0 ml-2">
                    {project.code}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* TEAM Section */}
        <div className="space-y-2">
          <div className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            Team
          </div>

          <div className="space-y-0.5">
            {teamMembers.map((member) => (
              <Link
                key={member.name}
                href="/team"
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full ${member.bgColor} text-[10px] font-semibold flex items-center justify-center`}
                    >
                      {member.initials}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${member.statusColor}`}
                    />
                  </div>
                  <span className="truncate text-xs font-medium text-slate-800">
                    {member.name}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                  {member.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* RECENT ACTIVITY Section */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="px-3 text-[11px] font-semibold text-slate-400 tracking-wider uppercase">
            Recent Activity
          </div>

          <div className="px-2.5 py-1 flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-pink-100 text-pink-700 text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              AR
            </div>
            <div className="text-[11px] text-slate-600 leading-snug">
              <span className="font-semibold text-slate-800">Ana</span> moved
              ATL-139 to In Review
              <div className="text-[10px] text-slate-400 mt-0.5">· 12m</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
