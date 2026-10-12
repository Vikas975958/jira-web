"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  FiX,
  FiMail,
  FiGlobe,
  FiShield,
  FiUsers,
  FiSend,
  FiCheckCircle,
  FiCopy,
  FiCheck,
  FiExternalLink,
} from "react-icons/fi";
import profileService from "@/services/profile.service";
import { MEMBER_ROLE, MANAGER_ROLE } from "@/utils/constants";

export default function AddProfileModal({
  isOpen,
  onClose,
  onSuccess,
}) {
  const authState = useSelector((state) => state.authSlice);
  const currentUser = authState?.userData;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState(MEMBER_ROLE);
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [inviteSuccessData, setInviteSuccessData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Pre-fill organization name from current user
  useEffect(() => {
    if (isOpen) {
      if (currentUser?.organization_name) {
        setOrganizationName(currentUser.organization_name);
      }
      setEmail("");
      setRole(MEMBER_ROLE);
      setErrorMessage("");
      setInviteSuccessData(null);
      setCopied(false);
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const validateEmail = (val) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  };

  const handleCopyLink = () => {
    if (inviteSuccessData?.inviteLink) {
      navigator.clipboard.writeText(inviteSuccessData.inviteLink);
      setCopied(true);
      toast.success("Invitation link copied to clipboard!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const trimmedEmail = email.trim();
    const trimmedOrg = organizationName.trim();

    if (!trimmedEmail) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    if (!validateEmail(trimmedEmail)) {
      setErrorMessage("Please enter a valid email format (e.g. name@company.com).");
      return;
    }

    if (!role || ![MANAGER_ROLE, MEMBER_ROLE].includes(role)) {
      setErrorMessage("Please select a valid role (Manager or Member).");
      return;
    }

    if (!trimmedOrg) {
      setErrorMessage("Please enter the organization name.");
      return;
    }

    setLoading(true);

    try {
      const res = await profileService.inviteUser({
        email: trimmedEmail,
        role: role,
        organizationName: trimmedOrg,
        createdBy: currentUser?.id,
      });

      setInviteSuccessData(res);
      toast.success(`Invitation ready for ${trimmedEmail}!`);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Invitation error:", err);
      const message =
        err?.message ||
        "Failed to send invitation. Please verify network and permissions.";
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetForAnother = () => {
    setEmail("");
    setRole(MEMBER_ROLE);
    setErrorMessage("");
    setInviteSuccessData(null);
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {inviteSuccessData ? "Invitation Created" : "Invite Team Member"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {inviteSuccessData
                ? "The invitation link has been generated with role permissions preserved."
                : "Send an invitation to join your organization on Jira."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {inviteSuccessData ? (
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold">
                <FiCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Invitation is ready!</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Invited <b>{email}</b> as a{" "}
                  <span className="font-bold uppercase text-emerald-950">
                    {role}
                  </span>{" "}
                  in <b>{organizationName}</b>.
                </p>
              </div>
            </div>

            {/* Invite Link Box */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Signup & Invitation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteSuccessData?.inviteLink || ""}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="h-10 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs"
                >
                  {copied ? (
                    <>
                      <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <FiCopy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Share this link with the invited user. It will open the Signup page with their role, organization, and inviter ID securely pre-filled.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetForAnother}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Invite Another
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-[#0052CC] hover:bg-[#0747A6] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Error Alert */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
                <span className="text-sm">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold">Unable to create invite</p>
                  <p className="text-[11px] text-red-600 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label
                htmlFor="invite-email"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiMail className="w-4 h-4" />
                </div>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full h-10 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Select Role <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {/* Member Card */}
                <label
                  className={`relative flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    role === MEMBER_ROLE
                      ? "border-blue-600 bg-blue-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={MEMBER_ROLE}
                    checked={role === MEMBER_ROLE}
                    onChange={() => setRole(MEMBER_ROLE)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <FiUsers className="w-4 h-4 text-blue-600" />
                      Member
                    </div>
                    {role === MEMBER_ROLE && (
                      <FiCheckCircle className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Can create, assign, and update issues and view team projects.
                  </p>
                </label>

                {/* Manager Card */}
                <label
                  className={`relative flex flex-col p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    role === MANAGER_ROLE
                      ? "border-purple-600 bg-purple-50/50"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={MANAGER_ROLE}
                    checked={role === MANAGER_ROLE}
                    onChange={() => setRole(MANAGER_ROLE)}
                    className="sr-only"
                  />
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                      <FiShield className="w-4 h-4 text-purple-600" />
                      Manager
                    </div>
                    {role === MANAGER_ROLE && (
                      <FiCheckCircle className="w-4 h-4 text-purple-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    Full sprint management, project configuration, and team invites.
                  </p>
                </label>
              </div>
            </div>

            {/* Organization Name */}
            <div>
              <label
                htmlFor="invite-org"
                className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Organization Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiGlobe className="w-4 h-4" />
                </div>
                <input
                  id="invite-org"
                  type="text"
                  required
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="Acme Corp"
                  className="w-full h-10 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#0052CC] hover:bg-[#0747A6] active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating Invite...</span>
                  </>
                ) : (
                  <>
                    <FiSend className="w-3.5 h-3.5" />
                    <span>Send Invitation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
