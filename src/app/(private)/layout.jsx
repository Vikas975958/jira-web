"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import CreateIssueModal from "@/components/CreateIssueModal";
import { IssueProvider, useIssues } from "@/context/IssueContext";
import { OrganizationProvider, useOrganization } from "@/context/OrganizationContext";

function PrivateLayoutContent({ children }) {
  const { setIsCreateModalOpen } = useIssues();
  const { hasOrganization } = useOrganization();
  const pathname = usePathname();

  const isCreateOrg = pathname?.includes("/dashboard/create-organization");
  // Only show Jira Admin / App flow (Header & Sidebar) when user has created an organization
  // and is not on the create-organization onboarding page
  const showAdminFlow = !isCreateOrg && hasOrganization;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Jira Header - shown only once organization is created */}
      {showAdminFlow && (
        <Header onCreateIssueClick={() => setIsCreateModalOpen(true)} />
      )}

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {showAdminFlow && <Sidebar />}
        <main className="flex-1 overflow-y-auto bg-white">
          {children}
        </main>
      </div>

      {/* Global Jira Issue Creation Modal */}
      {showAdminFlow && <CreateIssueModal />}
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <IssueProvider>
      <OrganizationProvider>
        <PrivateLayoutContent>{children}</PrivateLayoutContent>
      </OrganizationProvider>
    </IssueProvider>
  );
}
