"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  FiX,
  FiCamera,
  FiUsers,
  FiSearch,
  FiCheck,
  FiTrash2,
} from "react-icons/fi";
import { toast } from "react-toastify";
import { getNameInitials } from "@/utils/commonFunction";
import chatService from "../chatService";

export default function CreateGroupModal({
  isOpen,
  onClose,
  teamMembers = [],
  currentUserId,
  orgId,
  onCreateGroupSuccess,
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // Available members (excluding self)
  const availableMembers = useMemo(() => {
    return (teamMembers || [])
      .map((m) => {
        const uId = m.user_id || m.id || m.profiles?.id;
        return {
          user_id: uId,
          full_name: m.full_name || m.name || m.profiles?.full_name || "Teammate",
          email: m.email || m.profiles?.email || "",
          role: m.role || "member",
        };
      })
      .filter((m) => m.user_id && m.user_id !== currentUserId);
  }, [teamMembers, currentUserId]);

  // Filtered members based on search
  const filteredMembers = useMemo(() => {
    if (!searchQuery?.trim()) return availableMembers;
    const q = searchQuery.toLowerCase().trim();
    return availableMembers.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [availableMembers, searchQuery]);

  if (!isOpen) return null;

  // Handle image pick
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Member selection toggle
  const toggleMember = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUserIds.length === availableMembers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(availableMembers.map((m) => m.user_id));
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelectedUserIds([]);
    setSearchQuery("");
    setImageFile(null);
    setImagePreview(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a group name");
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one member for the group");
      return;
    }

    try {
      setIsSubmitting(true);

      let groupImageUrl = null;
      if (imageFile) {
        groupImageUrl = await chatService.uploadGroupImage(imageFile);
      }

      const newGroup = await chatService.createGroup({
        organizationId: orgId,
        name: trimmedName,
        description: description.trim(),
        groupImage: groupImageUrl,
        memberUserIds: selectedUserIds,
      });

      toast.success(`Group "${trimmedName}" created successfully!`);
      resetForm();
      if (onCreateGroupSuccess) {
        onCreateGroupSuccess(newGroup);
      }
      onClose();
    } catch (err) {
      console.error("Create group error:", err);
      toast.error(err.message || "Failed to create group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0F766E] text-white flex items-center justify-center font-bold text-sm shadow-xs">
              <FiUsers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Create New Group
              </h3>
              <p className="text-xs text-slate-500">
                Collaborate with multiple teammates in real-time
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Avatar and Group Details Row */}
          <div className="flex items-start gap-4">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative group">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-2xl bg-teal-50 border-2 border-dashed border-teal-300 hover:border-[#0F766E] flex items-center justify-center cursor-pointer overflow-hidden transition-colors relative"
                  title="Upload group picture"
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imagePreview}
                      alt="Group Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-teal-700">
                      <FiCamera className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px] font-semibold">Photo</span>
                    </div>
                  )}
                </div>

                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-xs hover:bg-rose-600 transition-colors cursor-pointer"
                    title="Remove photo"
                  >
                    <FiTrash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </div>

            {/* Group Name & Description */}
            <div className="flex-1 space-y-2.5 min-w-0">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Group Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Design Team, Product Launch"
                  maxLength={60}
                  className="w-full text-xs sm:text-sm bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#0F766E] focus:bg-white focus:ring-1 focus:ring-teal-600/20 transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is this group about?"
                  maxLength={150}
                  className="w-full text-xs bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-[#0F766E] focus:bg-white focus:ring-1 focus:ring-teal-600/20 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Member Selection Section */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-700">Add Members</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 text-[#0F766E] font-semibold border border-teal-200/60">
                  {selectedUserIds.length} selected
                </span>
              </div>
              {availableMembers.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-[#0F766E] hover:underline font-semibold cursor-pointer"
                >
                  {selectedUserIds.length === availableMembers.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
            </div>

            {/* Search Input for Members */}
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teammates by name or email..."
                className="w-full bg-slate-50 border border-slate-200 text-xs rounded-xl pl-8 pr-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:bg-white focus:border-[#0F766E] transition-all"
              />
            </div>

            {/* Members List */}
            <div className="max-h-56 overflow-y-auto space-y-1 border border-slate-100 rounded-xl p-1 bg-slate-50/40">
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const isSelected = selectedUserIds.includes(member.user_id);
                  const initials = getNameInitials(member.full_name);

                  return (
                    <button
                      key={member.user_id}
                      type="button"
                      onClick={() => toggleMember(member.user_id)}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-teal-50/80 border border-teal-200 text-teal-900"
                          : "hover:bg-white border border-transparent text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                            isSelected
                              ? "bg-[#0F766E] text-white"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {member.full_name}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {member.email}
                          </p>
                        </div>
                      </div>

                      {/* Checkbox indicator */}
                      <div
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ml-2 ${
                          isSelected
                            ? "bg-[#0F766E] border-[#0F766E] text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <FiCheck className="w-3.5 h-3.5 stroke-3" />}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  No teammates match your search.
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || selectedUserIds.length === 0}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0F766E] hover:bg-[#0D655E] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating Group...</span>
                </>
              ) : (
                <span>Create Group</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
