"use client";

import React, { useState } from "react";
import { FiX, FiCheck, FiBookmark, FiAlertCircle, FiCheckSquare } from "react-icons/fi";
import { useIssues } from "@/context/IssueContext";

export default function CreateIssueModal() {
  const { isCreateModalOpen, setIsCreateModalOpen, addTicket } = useIssues();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("story");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [storyPoints, setStoryPoints] = useState(3);
  const [assignee, setAssignee] = useState("Alex Morgan");

  if (!isCreateModalOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    addTicket({
      title: title.trim(),
      description: description.trim(),
      type,
      status,
      priority,
      storyPoints: Number(storyPoints) || 1,
      assignee: assignee.trim() || "Unassigned",
      tags: ["Sprint24"],
    });

    setTitle("");
    setDescription("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              +
            </div>
            <h2 className="text-base font-bold text-slate-800">Create Issue</h2>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Project & Issue Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Project
              </label>
              <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                Jira Web Core (JIRA)
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Issue Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="story">📗 Story</option>
                <option value="task">📘 Task</option>
                <option value="bug">🔴 Bug</option>
              </select>
            </div>
          </div>

          {/* Title / Summary */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Summary <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement webhook notification listener"
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, acceptance criteria, or technical details..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="todo">📋 To Do</option>
                <option value="in-progress">⚡ In Progress</option>
                <option value="review">🔍 Code Review</option>
                <option value="done">✅ Done</option>
              </select>
            </div>
          </div>

          {/* Story Points & Assignee */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Story Points
              </label>
              <input
                type="number"
                min="1"
                max="21"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                0
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Assignee name"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-semibold rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FiCheck className="w-4 h-4" />
              <span>Create Issue</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
