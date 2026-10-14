"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import {
  OrganizationProvider,
  useOrganization,
} from "@/context/OrganizationContext";
import {
  SidebarProvider,
  useSidebar,
} from "@/context/SidebarContext";

function PrivateLayoutContent({ children }) {
  const pathname = usePathname();
  const { hasOrganization, loadingOrgs } = useOrganization();
  const { isMobileOpen, closeMobile } = useSidebar();

  // Hide sidebar and header on the create-organization onboarding page
  const isCreateOrg = pathname?.includes("/dashboard/create-organization");

  // Only show Header & Sidebar when user has an active organization
  // and is not on the create-organization onboarding flow
  const showNav = !isCreateOrg && !loadingOrgs && hasOrganization;

  return (
    <div className="h-screen max-h-screen flex flex-col bg-slate-100 text-slate-800 overflow-hidden">
      {/* Top WorkGrid Header */}
      {showNav && <Header />}

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Mobile Backdrop Overlay */}
        {showNav && isMobileOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 z-40 md:hidden backdrop-blur-xs transition-opacity"
            onClick={closeMobile}
          />
        )}

        {showNav && <Sidebar />}
        <main className="flex-1 overflow-y-auto bg-white min-h-0 h-full">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function PrivateLayout({ children }) {
  return (
    <OrganizationProvider>
      <SidebarProvider>
        <PrivateLayoutContent>{children}</PrivateLayoutContent>
      </SidebarProvider>
    </OrganizationProvider>
  );
}
