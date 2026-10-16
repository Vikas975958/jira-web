"use client";

import React from "react";

export default function IssuePageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50/70 pb-16 animate-pulse select-none">
      {/* Top Breadcrumb & Actions Bar Skeleton */}
      <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-20 bg-slate-200 rounded" />
              <div className="h-3.5 w-3 bg-slate-100 rounded" />
              <div className="h-3.5 w-24 bg-slate-200 rounded" />
            </div>
            <div className="h-4.5 w-32 bg-slate-200 rounded mt-0.5" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-7 w-16 bg-slate-200 rounded-lg" />
            <div className="h-7 w-24 bg-teal-100/70 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Main Form/Details Skeleton Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-3.5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Main 8 Columns */}
          <div className="lg:col-span-8 space-y-3.5">
            {/* Summary / Title Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="space-y-1.5">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-8 w-full bg-slate-100 rounded-lg" />
              </div>

              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-8 bg-slate-100 rounded-lg" />
                  ))}
                </div>
              </div>
            </div>

            {/* Description Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="h-5 w-24 bg-slate-100 rounded-lg" />
              </div>
              <div className="h-28 w-full bg-slate-100 rounded-lg" />
            </div>

            {/* Subtasks Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="h-3 w-36 bg-slate-200 rounded" />
              <div className="space-y-1.5">
                <div className="h-8 w-full bg-slate-100 rounded-lg" />
                <div className="h-8 w-full bg-slate-100 rounded-lg" />
              </div>
            </div>
          </div>

          {/* Sidebar 4 Columns */}
          <div className="lg:col-span-4 space-y-3.5">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="h-7 w-full bg-slate-100 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="h-7 w-full bg-slate-100 rounded-lg" />
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="h-7 w-full bg-slate-100 rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <div className="h-3 w-16 bg-slate-200 rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-7 bg-slate-100 rounded-lg" />
                  <div className="h-7 bg-slate-100 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-7 w-full bg-slate-100 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
