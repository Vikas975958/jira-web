"use client";

import React from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import CreateIssueModal from "@/components/CreateIssueModal";
import { IssueProvider, useIssues } from "@/context/IssueContext";

function PrivateLayoutContent({ children }) {
  const { setIsCreateModalOpen } = useIssues();

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      {/* Top Jira Header */}
      <Header onCreateIssueClick={() => setIsCreateModalOpen(true)} />

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-white">
          {children}
        </main>
      </div>

      {/* Global Jira Issue Creation Modal */}
      <CreateIssueModal />
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <IssueProvider>
      <PrivateLayoutContent>{children}</PrivateLayoutContent>
    </IssueProvider>
  );
}
