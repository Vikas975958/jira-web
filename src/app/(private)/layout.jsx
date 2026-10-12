"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import {
  OrganizationProvider,
  useOrganization,
} from "@/context/OrganizationContext";

function PrivateLayoutContent({ children }) {
  const pathname = usePathname();
  const { hasOrganization, loadingOrgs } = useOrganization();

  // Hide sidebar and header on the create-organization onboarding page
  const isCreateOrg = pathname?.includes("/dashboard/create-organization");

  // Only show Header & Sidebar when user has an active organization
  // and is not on the create-organization onboarding flow
  const showNav = !isCreateOrg && !loadingOrgs && hasOrganization;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Jira Header */}
      {showNav && <Header />}

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {showNav && <Sidebar />}
        <main className="flex-1 overflow-y-auto bg-white min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PrivateLayout({ children }) {
  return (
    <OrganizationProvider>
      <PrivateLayoutContent>{children}</PrivateLayoutContent>
    </OrganizationProvider>
  );
}
