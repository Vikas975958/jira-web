"use client";

import React, { createContext, useContext, useState } from "react";
import { toast } from "react-toastify";

const initialTickets = [
  {
    id: "JIRA-101",
    title: "Implement Supabase OAuth & Session Storage with Cookies",
    description: "Connect Supabase authentication tokens, synchronize with Redux store, and guard private routes with middleware.",
    status: "done",
    priority: "high",
    type: "story",
    storyPoints: 5,
    assignee: "Alex Morgan",
    tags: ["Auth", "Security"],
  },
  {
    id: "JIRA-102",
    title: "Design modern Jira Cloud Sign-In & Sign-Up experience",
    description: "Build high-converting, responsive auth views with Jira enterprise styling, validation, and demo credentials.",
    status: "done",
    priority: "high",
    type: "story",
    storyPoints: 5,
    assignee: "Antigravity",
    tags: ["Design", "UI/UX"],
  },
  {
    id: "JIRA-103",
    title: "Refactor Redux Persist storage adapter for SSR hydration",
    description: "Ensure noop storage on SSR and localStorage on client to prevent Next.js hydration mismatches.",
    status: "done",
    priority: "medium",
    type: "task",
    storyPoints: 3,
    assignee: "Dev Lead",
    tags: ["State", "Redux"],
  },
  {
    id: "JIRA-104",
    title: "Agile Sprint 24 Kanban Board & Velocity metrics",
    description: "Develop interactive multi-column board with ticket moving, priority badges, and sprint burn-down summary.",
    status: "in-progress",
    priority: "urgent",
    type: "story",
    storyPoints: 8,
    assignee: "Alex Morgan",
    tags: ["Kanban", "Core"],
  },
  {
    id: "JIRA-105",
    title: "Real-time task synchronization via Supabase Postgres changes",
    description: "Subscribe to ticket updates so board changes reflect instantaneously for team members.",
    status: "in-progress",
    priority: "high",
    type: "task",
    storyPoints: 5,
    assignee: "Sarah Chen",
    tags: ["Realtime", "Backend"],
  },
  {
    id: "JIRA-106",
    title: "Verify session refresh token lifecycle upon expiry",
    description: "Handle auto-token refresh in background before auth cookies expire.",
    status: "review",
    priority: "medium",
    type: "task",
    storyPoints: 3,
    assignee: "David Kim",
    tags: ["Auth", "DevOps"],
  },
  {
    id: "JIRA-107",
    title: "Fix responsive layout shifts on mobile viewport sizes",
    description: "Ensure sidebar collapses properly and Kanban board enables smooth horizontal scrolling.",
    status: "review",
    priority: "medium",
    type: "bug",
    storyPoints: 2,
    assignee: "Sarah Chen",
    tags: ["Mobile", "CSS"],
  },
  {
    id: "JIRA-108",
    title: "Configure GitHub CI/CD Actions for automated test runs",
    description: "Set up linting, build validation, and bundle analysis on pull requests.",
    status: "todo",
    priority: "low",
    type: "task",
    storyPoints: 3,
    assignee: "David Kim",
    tags: ["DevOps"],
  },
  {
    id: "JIRA-109",
    title: "Audit accessibility WCAG 2.1 AA across modal dialogs",
    description: "Check focus traps, keyboard navigation, and aria attributes.",
    status: "todo",
    priority: "medium",
    type: "task",
    storyPoints: 2,
    assignee: "Elena Rostova",
    tags: ["a11y"],
  },
  {
    id: "JIRA-110",
    title: "Export Sprint reports to CSV and PDF format",
    description: "Allow scrum masters to download sprint velocity reports for stakeholder meetings.",
    status: "todo",
    priority: "low",
    type: "story",
    storyPoints: 5,
    assignee: "Unassigned",
    tags: ["Reports"],
  },
];

const IssueContext = createContext(null);

export function IssueProvider({ children }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const addTicket = (newTicket) => {
    const nextId = `JIRA-${100 + tickets.length + 1}`;
    const ticket = {
      id: nextId,
      ...newTicket,
    };
    setTickets((prev) => [ticket, ...prev]);
    toast.success(`Created issue ${nextId}: "${ticket.title.slice(0, 30)}..."`);
    setIsCreateModalOpen(false);
  };

  const moveTicket = (ticketId, nextStatus) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: nextStatus } : t))
    );
  };

  const deleteTicket = (ticketId) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    toast.info(`Deleted issue ${ticketId}`);
  };

  return (
    <IssueContext.Provider
      value={{
        tickets,
        addTicket,
        moveTicket,
        deleteTicket,
        isCreateModalOpen,
        setIsCreateModalOpen,
      }}
    >
      {children}
    </IssueContext.Provider>
  );
}

export function useIssues() {
  const context = useContext(IssueContext);
  if (!context) {
    throw new Error("useIssues must be used within an IssueProvider");
  }
  return context;
}
