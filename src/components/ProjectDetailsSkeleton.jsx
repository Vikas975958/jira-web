"use client";

import React from "react";

export default function ProjectDetailsSkeleton() {
  return (
    <div className="min-h-full bg-slate-50/60 pb-12 animate-pulse select-none">
      {/* Top Banner & Header Skeleton */}
      <div className="bg-white/95 border-b border-slate-200/80 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
            {/* Back button & Title Section */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-slate-200 shrink-0" />
              <div className="w-8 h-8 rounded-lg bg-teal-100/70 border border-teal-200/60 shrink-0" />

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-44 sm:w-56 bg-slate-200 rounded-md" />
                  <div className="h-4 w-16 bg-emerald-100/80 rounded-md" />
                </div>
                <div className="h-3 w-32 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Quick Action Buttons Skeleton */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-7 w-20 bg-slate-200 rounded-lg" />
              <div className="h-7 w-36 bg-teal-600/30 rounded-lg" />
              <div className="h-7 w-16 bg-slate-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 space-y-5">
        {/* Project Overview Cards (4 Columns) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
          {/* Description Card (2 Columns) */}
          <div className="md:col-span-2 bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs space-y-2.5">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="space-y-1.5 pt-1">
              <div className="h-3.5 w-full bg-slate-100 rounded" />
              <div className="h-3.5 w-5/6 bg-slate-100 rounded" />
              <div className="h-3.5 w-2/3 bg-slate-100 rounded" />
            </div>
          </div>

          {/* Schedule & Dates Card (1 Column) */}
          <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs space-y-2.5">
            <div className="h-3 w-28 bg-slate-200 rounded" />
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 bg-slate-100 rounded" />
                <div className="h-3.5 w-20 bg-slate-200 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-20 bg-slate-100 rounded" />
                <div className="h-3.5 w-20 bg-slate-200 rounded" />
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <div className="h-3 w-14 bg-slate-100 rounded" />
                <div className="h-3 w-16 bg-slate-200 rounded" />
              </div>
            </div>
          </div>

          {/* Team Summary Card (1 Column) */}
          <div className="bg-white rounded-lg border border-slate-200/80 p-4 shadow-2xs space-y-2">
            <div className="h-3 w-24 bg-slate-200 rounded" />
            <div className="flex items-center gap-3 pt-0.5">
              <div className="w-10 h-10 rounded-lg bg-teal-100/70 border border-teal-200/60 shrink-0" />
              <div className="space-y-1.5">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* Team Management Section (2 Col Table + 1 Col Action Panel) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column (2 Cols): Team Members Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Header with Search Input */}
              <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200/70 flex items-center justify-between gap-4 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-teal-200/80" />
                  <div className="h-4 w-28 bg-slate-200 rounded" />
                </div>
                <div className="w-48 sm:w-64 h-8.5 bg-slate-200/70 rounded-lg" />
              </div>

              {/* Table Column Titles */}
              <div className="grid grid-cols-12 px-4 sm:px-5 py-2.5 bg-slate-50/80 border-b border-slate-200/60 text-[10px]">
                <div className="col-span-5">
                  <div className="h-3 w-14 bg-slate-200 rounded" />
                </div>
                <div className="col-span-3">
                  <div className="h-3 w-10 bg-slate-200 rounded" />
                </div>
                <div className="col-span-3">
                  <div className="h-3 w-12 bg-slate-200 rounded" />
                </div>
                <div className="col-span-1 flex justify-end">
                  <div className="h-3 w-8 bg-slate-200 rounded" />
                </div>
              </div>

              {/* Table Rows Skeleton */}
              <div className="divide-y divide-slate-100">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 px-4 sm:px-5 py-3 items-center gap-2"
                  >
                    {/* Name & Avatar */}
                    <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
                      <div className="h-3.5 w-28 sm:w-36 bg-slate-200 rounded" />
                    </div>

                    {/* Role */}
                    <div className="col-span-3">
                      <div className="h-5 w-16 sm:w-20 bg-teal-50 border border-teal-100 rounded-md" />
                    </div>

                    {/* Email */}
                    <div className="col-span-3">
                      <div className="h-3.5 w-32 sm:w-40 bg-slate-100 rounded" />
                    </div>

                    {/* Action */}
                    <div className="col-span-1 flex justify-end">
                      <div className="w-6 h-6 rounded bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Add & Invite Members Card */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-slate-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100/70 border border-teal-200/60 shrink-0" />
                <div className="space-y-1">
                  <div className="h-3.5 w-36 bg-slate-200 rounded" />
                  <div className="h-2.5 w-44 bg-slate-100 rounded" />
                </div>
              </div>

              {/* Sub-Tabs Toggle */}
              <div className="flex rounded-lg bg-slate-100/80 p-1 border border-slate-200/60 gap-1">
                <div className="flex-1 h-7 bg-white rounded-md shadow-2xs" />
                <div className="flex-1 h-7 bg-transparent rounded-md" />
              </div>

              {/* Form Input Skeletons */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                  <div className="h-8.5 w-full bg-slate-100 rounded-lg border border-slate-200/60" />
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 w-24 bg-slate-200 rounded" />
                  <div className="h-8.5 w-full bg-slate-100 rounded-lg border border-slate-200/60" />
                </div>
                <div className="h-8.5 w-full bg-teal-600/30 rounded-lg mt-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
