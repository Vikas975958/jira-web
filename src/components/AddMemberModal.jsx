"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  FiUserPlus,
  FiShield,
  FiMail,
  FiUser,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiInfo,
  FiLock,
  FiCopy,
  FiArrowLeft,
  FiSend,
} from "react-icons/fi";
import { useOrganization } from "@/context/OrganizationContext";
import organizationService from "@/services/organization.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

export default function AddMemberModal({
  isOpen,
  onClose,
  organizationId,
  organizationName,
  currentUserId,
  currentUserRole,
  defaultRole = MEMBER_ROLE,
  onSuccess,
}) {
  const authState = useSelector((state) => state.authSlice);
  const { currentOrg } = useOrganization();

  // Determine effective role: explicit prop > currentOrg context > authState
  const effectiveCallerRole =
    currentUserRole ||
    currentOrg?.role ||
    authState?.userData?.role ||
    MEMBER_ROLE;

  // Strict permission: Only workspace owner can invite managers.
  // Managers can ONLY invite team members.
  const canInviteManager = effectiveCallerRole === OWNER_ROLE;

  const initialRole = canInviteManager ? (defaultRole || MEMBER_ROLE) : MEMBER_ROLE;
  const [role, setRole] = useState(initialRole);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successResult, setSuccessResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef(null);

  // isManager is only true if caller has owner permission AND chose manager
  const isManager = canInviteManager && role === MANAGER_ROLE;

  useEffect(() => {
    if (isOpen) {
      setRole(canInviteManager ? (defaultRole || MEMBER_ROLE) : MEMBER_ROLE);
      setFullName("");
      setEmail("");
      setMessage("");
      setErrorMsg("");
      setSuccessResult(null);
      setCopied(false);
    }
  }, [isOpen, defaultRole, canInviteManager]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape" && !loading) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, loading, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !loading) onClose();
  };

  const handleCopyLink = () => {
    if (successResult?.signupUrl) {
      navigator.clipboard.writeText(successResult.signupUrl);
      setCopied(true);
      toast.success("Invitation link copied!");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleDone = () => {
    if (successResult && onSuccess) onSuccess(successResult);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedEmail = email.trim();
    const trimmedName = fullName.trim() || trimmedEmail.split("@")[0];

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!organizationId) {
      setErrorMsg("No active organization found. Please select an organization.");
      return;
    }
    if (!canInviteManager && role === MANAGER_ROLE) {
      setErrorMsg("Managers are not permitted to invite managers. Only the workspace owner can invite managers.");
      return;
    }

    setLoading(true);
    try {
      let result;
      if (canInviteManager && isManager) {
        result = await organizationService.createManagerRequest({
          organizationId,
          fullName: trimmedName,
          email: trimmedEmail,
          message: message.trim() || null,
          requestedBy: currentUserId,
          invitedBy: currentUserId,
        });
        toast.success(`Manager invitation created for ${trimmedEmail}!`);
      } else {
        result = await organizationService.createMemberRequest({
          organizationId,
          fullName: trimmedName,
          email: trimmedEmail,
          message: message.trim() || null,
          requestedBy: currentUserId,
          invitedBy: currentUserId,
        });
        toast.success(`Member invitation created for ${trimmedEmail}!`);
      }
      setSuccessResult(result);
    } catch (err) {
      console.error("Submit request error:", err);
      const msg = err?.message || "Failed to submit request. Please try again.";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          animation: "modalSlideIn 0.2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="h-1 w-full"
          style={{
            background: isManager
              ? "linear-gradient(90deg, #7c3aed, #4f46e5)"
              : "linear-gradient(90deg, #0052cc, #0ea5e9)",
          }}
        />

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: isManager
                  ? "linear-gradient(135deg, #ede9fe, #ddd6fe)"
                  : "linear-gradient(135deg, #dbeafe, #bfdbfe)",
              }}
            >
              {isManager ? (
                <FiShield className="w-5 h-5 text-purple-700" />
              ) : (
                <FiUserPlus className="w-5 h-5 text-blue-700" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                {isManager ? "Invite a Manager" : "Add Team Member"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 leading-none">
                {organizationName || "Your Workspace"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Close modal"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1" style={{ overscrollBehavior: "contain" }}>
          {successResult ? (
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                  <FiCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-900">Invitation Created!</p>
                  <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                    Request stored in{" "}
                    <code className="font-mono bg-emerald-100 px-1 rounded text-[11px]">
                      {isManager ? "request_manager" : "request_member"}
                    </code>{" "}
                    with status <span className="font-bold">pending</span>.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                <div className="bg-slate-50 px-4 py-2 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Invitation Summary
                </div>
                <div className="divide-y divide-slate-100">
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-slate-500">Email</span>
                    <span className="font-semibold text-slate-800 font-mono">{successResult.email}</span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-slate-500">Role</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        isManager ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {isManager ? "Manager" : "Member"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-4 py-3">
                    <span className="text-slate-500">Organization</span>
                    <span className="font-semibold text-slate-800">{organizationName || "Current Workspace"}</span>
                  </div>
                </div>
              </div>

              {successResult.signupUrl && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Invitation Link
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={successResult.signupUrl}
                      className="flex-1 min-w-0 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        copied ? "bg-emerald-500 text-white" : "bg-slate-900 hover:bg-slate-700 text-white"
                      }`}
                    >
                      {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Share this link with the candidate. It includes a secure role-locked token.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessResult(null);
                    setEmail("");
                    setFullName("");
                    setMessage("");
                    setErrorMsg("");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
                >
                  <FiArrowLeft className="w-3.5 h-3.5" />
                  Invite another
                </button>
                <button
                  type="button"
                  onClick={handleDone}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  <FiCheck className="w-3.5 h-3.5" />
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {errorMsg && (
                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  <FiAlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {canInviteManager ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Invitation Role <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRole(MEMBER_ROLE)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        !isManager ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <FiUserPlus className="w-3.5 h-3.5" />
                      Team Member
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole(MANAGER_ROLE)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isManager ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <FiShield className="w-3.5 h-3.5" />
                      Manager
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Invitation Role
                  </label>
                  <div className="flex items-center justify-between px-3.5 py-3 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <FiUserPlus className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900">Team Member</span>
                        <p className="text-[11px] text-slate-500 leading-tight">
                          Invited member will report directly under you
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-white border border-blue-200 px-2 py-0.5 rounded-md shadow-xs">
                      Locked
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Managers can only invite team members. Only the workspace owner can invite managers.
                  </p>
                </div>
              )}

              <div
                className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs ${
                  isManager
                    ? "bg-purple-50/60 border-purple-200 text-purple-800"
                    : "bg-blue-50/60 border-blue-100 text-blue-800"
                }`}
              >
                {isManager ? (
                  <FiLock className="w-4 h-4 shrink-0 mt-0.5 text-purple-600" />
                ) : (
                  <FiInfo className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                )}
                <div>
                  <p className={`font-bold ${isManager ? "text-purple-900" : "text-blue-900"}`}>
                    {isManager ? "Manager Invitation" : "Member Invitation"}
                  </p>
                  <p className="mt-0.5 leading-relaxed opacity-80">
                    Creates a record in{" "}
                    <code className={`font-mono px-1 rounded text-[11px] ${isManager ? "bg-purple-100" : "bg-blue-100"}`}>
                      {isManager ? "request_manager" : "request_member"}
                    </code>{" "}
                    with role locked to <strong>{isManager ? MANAGER_ROLE : MEMBER_ROLE}</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label htmlFor="add-modal-email" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="add-modal-email"
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="candidate@company.com"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="add-modal-name" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Full Name <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="add-modal-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Jordan Taylor"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="add-modal-note" className="block text-xs font-bold text-slate-700 mb-1.5">
                  Invitation Note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  id="add-modal-note"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a welcome note for the candidate..."
                  className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isManager
                      ? "bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 shadow-purple-500/20"
                      : "bg-[#0052CC] hover:bg-[#0747A6] shadow-blue-500/20"
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
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

      <style>{`
        @keyframes modalSlideIn {
          from { opacity: 0; transform: scale(0.96) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>
    </div>
  );
}