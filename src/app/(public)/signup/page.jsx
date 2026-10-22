"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Select } from "antd";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FiUser,
  FiMail,
  FiPhone,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiCheck,
  FiShield,
  FiBriefcase,
  FiLayers,
  FiAlertCircle,
  FiImage,
} from "react-icons/fi";
import JiraLogo from "@/components/JiraLogo";
import { useAuth } from "@/hooks/useAuth";
import organizationService from "@/services/organization.service";
import { MEMBER_ROLE, MANAGER_ROLE, OWNER_ROLE } from "@/utils/constants";

const DEPARTMENT_OPTIONS = [
  "Engineering & Technology",
  "Product & Design",
  "Marketing & Growth",
  "Sales & Business Development",
  "Operations & Strategy",
  "Human Resources & People",
  "Finance & Legal",
  "Customer Support",
  "Other",
];

const EMPLOYEE_TYPE_OPTIONS = [
  "Full-time",
  "Part-time",
  "Contract",
  "Intern",
];

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, loading } = useAuth();

  const roleParam = searchParams.get("role");
  const tokenParam = searchParams.get("token");
  const projectIdParam = searchParams.get("projectId");

  // Invitation state
  const isInvitation = Boolean(tokenParam && roleParam);
  const [validatingToken, setValidatingToken] = useState(isInvitation);
  const [invitationError, setInvitationError] = useState("");
  const [invitationData, setInvitationData] = useState(null);

  // Form inputs
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Employee details for invited members/managers
  const [department, setDepartment] = useState("Engineering & Technology");
  const [employeeType, setEmployeeType] = useState("Full-time");
  const [jobTitle, setJobTitle] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successConfirmation, setSuccessConfirmation] = useState(false);

  // Validate invitation token if present
  useEffect(() => {
    let isMounted = true;

    async function checkInvitation() {
      if (!tokenParam || !roleParam) return;

      setValidatingToken(true);
      setInvitationError("");

      try {
        const result = await organizationService.verifyInvitationToken({
          token: tokenParam,
          role: roleParam,
          projectId: projectIdParam,
        });

        if (!isMounted) return;

        if (!result.valid) {
          setInvitationError(result.error || "Invalid invitation token.");
          setInvitationData(null);
        } else {
          setInvitationData(result);
          if (result.email) setEmail(result.email);
          if (result.fullName) setFullName(result.fullName);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Token verification error:", err);
        setInvitationError("Could not verify invitation token. Please check the link or contact your admin.");
      } finally {
        if (isMounted) setValidatingToken(false);
      }
    }

    if (isInvitation) {
      checkInvitation();
    }

    return () => {
      isMounted = false;
    };
  }, [tokenParam, roleParam, isInvitation]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify.");
      return;
    }

    if (!agreedToTerms) {
      setErrorMsg("Please accept the terms of service to continue.");
      return;
    }

    // Double-check invitation validity if in invitation mode
    if (isInvitation && invitationError) {
      setErrorMsg(invitationError);
      return;
    }

    try {
      const payload = {
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || null,
      };

      if (isInvitation && invitationData?.role) {
        payload.token = tokenParam;
        payload.role = invitationData.role; // 'member' or 'manager'
        payload.employeeDetails = {
          department: department || null,
          employee_type: employeeType || "Full-time",
          job_title: jobTitle?.trim() || null,
          company_name: invitationData.organization?.name || null,
          organization_id: invitationData.organization?.id || invitationData.invitation?.organization_id || null,
          phone: phone.trim() || null,
          profile_photo: profilePhoto.trim() || null,
        };
      } else {
        payload.role = OWNER_ROLE;
      }

      const result = await signUp(payload);

      if (result?.requiresVerification) {
        setSuccessConfirmation(true);
      }
    } catch (err) {
      console.error("Sign-up error:", err);
      const message = err?.message || "Failed to create account. Please try again.";
      setErrorMsg(message);
    }
  };

  const isManagerRole = isInvitation && invitationData?.role === MANAGER_ROLE;
  const isMemberRole = isInvitation && invitationData?.role === MEMBER_ROLE;
  const orgName = invitationData?.organization?.name || "WorkGrid Organization";

  return (
    <div className="min-h-screen w-full flex bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 text-slate-800 select-none">
      {/* Left Column: Form */}
      <div className="w-full lg:w-1/2 min-h-screen flex flex-col justify-between px-6 py-6 sm:px-10 lg:px-14 xl:px-16 overflow-y-auto">
        {/* Brand Header */}
        <div className="w-full max-w-[520px] mx-auto flex items-center justify-between shrink-0 mb-4">
          <JiraLogo className="w-9 h-9" textColor="text-slate-900" />
          <Link
            href="/signin"
            className="text-xs sm:text-sm font-semibold text-[#0F766E] hover:text-teal-800 transition-colors"
          >
            Already have an account? Sign In →
          </Link>
        </div>

        {/* Center Content Container */}
        <div className="w-full max-w-[520px] mx-auto my-auto flex flex-col justify-center py-4">
          {/* Validating Invitation Spinner */}
          {validatingToken ? (
            <div className="p-8 bg-white rounded-lg border border-slate-200 text-center space-y-4 shadow-sm animate-fadeIn">
              <div className="w-10 h-10 border-3 border-[#0F766E] border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-base font-bold text-slate-800">Verifying Workspace Invitation...</h2>
              <p className="text-xs text-slate-500">Checking invitation security token and permissions.</p>
            </div>
          ) : invitationError ? (
            /* Invalid or Expired Invitation Alert */
            <div className="p-6 bg-white rounded-lg border border-red-200 shadow-sm space-y-4 animate-fadeIn">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-lg shrink-0">
                  <FiAlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Invitation Invalid or Expired</h2>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed">{invitationError}</p>
                </div>
              </div>
              <div className="pt-2 flex flex-wrap gap-2.5">
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] text-white text-xs font-bold rounded-lg transition-all shadow-xs"
                >
                  Create New Owner Account
                </Link>
                <Link
                  href="/signin"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-all"
                >
                  Sign In Existing Account
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Form Header */}
              <div className="mb-5">
                {isInvitation ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border shadow-2xs bg-teal-50 text-[#0F766E] border-teal-200">
                      {isManagerRole ? (
                        <>
                          <FiShield className="w-3.5 h-3.5 text-purple-600" />
                          <span>Manager Invitation</span>
                        </>
                      ) : (
                        <>
                          <FiUser className="w-3.5 h-3.5 text-[#0F766E]" />
                          <span>Team Member Invitation</span>
                        </>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                      Join {orgName}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Complete your employee profile details to join the organization workspace.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                      Create your WorkGrid account
                    </h1>
                    <p className="mt-1.5 text-sm text-slate-500">
                      Get started with sprint planning, issue tracking, and real-time agility.
                    </p>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {errorMsg && (
                <div className="mb-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 animate-fadeIn">
                  <span className="text-sm mt-0.5">⚠️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-xs">Registration error</p>
                    <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Email verification notice */}
              {successConfirmation ? (
                <div className="p-6 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-base">
                      ✓
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Account Created!</h3>
                      <p className="text-sm text-emerald-700">
                        A confirmation link has been sent to <b>{email}</b>.
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    You can now proceed to the Sign In page with your credentials.
                  </p>
                  <div className="pt-1">
                    <Link
                      href="/signin"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-all shadow-sm"
                    >
                      Proceed to Sign In
                      <FiArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* INVITATION INFO BADGES (Read-only Role & Organization) */}
                  {isInvitation && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-100/80 rounded-lg border border-slate-200/80 text-xs">
                      <div>
                        <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
                          Assigned Role (Read-Only)
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 font-bold">
                          {isManagerRole ? (
                            <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200">
                              Manager
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-[#0F766E] border border-teal-200">
                              Member
                            </span>
                          )}
                          <FiLock className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 font-medium block text-[10px] uppercase tracking-wider">
                          Organization
                        </span>
                        <div className="mt-1 font-bold text-slate-800 truncate">
                          {orgName}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Full Name */}
                  <div>
                    <label
                      htmlFor="fullName"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiUser className="w-4 h-4" />
                      </div>
                      <input
                        id="fullName"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Email (Read-only if invited, editable otherwise) */}
                  <div>
                    <label
                      htmlFor="signup-email"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Email Address <span className="text-red-500">*</span>
                      {isInvitation && (
                        <span className="text-[#0F766E] font-normal lowercase ml-1">(locked from invite)</span>
                      )}
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiMail className="w-4 h-4" />
                      </div>
                      <input
                        id="signup-email"
                        type="email"
                        required
                        readOnly={isInvitation}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className={`w-full h-11 pl-10 pr-4 border rounded-lg text-slate-900 text-sm focus:outline-none transition-all shadow-2xs placeholder:text-slate-400 ${
                          isInvitation
                            ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                            : "bg-white border-slate-300 focus:ring-2 focus:ring-[#0F766E] focus:border-transparent"
                        }`}
                      />
                      {isInvitation && (
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiLock className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EMPLOYEE DETAILS SECTION (Only displayed for invited members/managers) */}
                  {isInvitation && (
                    <div className="space-y-4 pt-1 pb-1 border-t border-b border-slate-200/80 my-2">
                      <div className="pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                          <FiBriefcase className="w-3.5 h-3.5 text-[#0F766E]" />
                          <span>Employee Details</span>
                        </span>
                      </div>

                      {/* Department & Employee Type in 2 cols */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="emp-department"
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                          >
                            Department
                          </label>
                          <Select
                            id="emp-department"
                            value={department}
                            onChange={(val) => setDepartment(val)}
                            className="w-full text-xs font-medium"
                            options={DEPARTMENT_OPTIONS.map((dept) => ({
                              value: dept,
                              label: dept,
                            }))}
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="emp-type"
                            className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                          >
                            Employee Type
                          </label>
                          <Select
                            id="emp-type"
                            value={employeeType}
                            onChange={(val) => setEmployeeType(val)}
                            className="w-full text-xs font-medium"
                            options={EMPLOYEE_TYPE_OPTIONS.map((type) => ({
                              value: type,
                              label: type,
                            }))}
                          />
                        </div>
                      </div>

                      {/* Job Title */}
                      <div>
                        <label
                          htmlFor="emp-jobTitle"
                          className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                        >
                          Job Title <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <FiBriefcase className="w-4 h-4" />
                          </div>
                          <input
                            id="emp-jobTitle"
                            type="text"
                            value={jobTitle}
                            onChange={(e) => setJobTitle(e.target.value)}
                            placeholder="e.g. Senior Frontend Engineer"
                            className="w-full h-10 pl-10 pr-4 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F766E] transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Phone Number */}
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                    >
                      Phone Number{" "}
                      <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiPhone className="w-4 h-4" />
                      </div>
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 000-0000"
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Password & Confirm */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="signup-password"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                      >
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiLock className="w-4 h-4" />
                        </div>
                        <input
                          id="signup-password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="6+ characters"
                          className="w-full h-11 pl-10 pr-9 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <FiEyeOff className="w-4 h-4" />
                          ) : (
                            <FiEye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-password"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                      >
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiLock className="w-4 h-4" />
                        </div>
                        <input
                          id="confirm-password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repeat password"
                          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F766E] focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="flex items-start gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded-lg border-slate-300 text-[#0F766E] focus:ring-[#0F766E] cursor-pointer"
                      />
                      <span className="text-xs text-slate-600 leading-tight">
                        I agree to WorkGrid Cloud Terms of Service and Privacy Policy.
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`w-full h-11 sm:h-12 px-5 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm ${
                      isManagerRole
                        ? "bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 shadow-purple-500/20"
                        : "bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] shadow-teal-900/20"
                    }`}
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Creating account...</span>
                      </>
                    ) : isInvitation ? (
                      <>
                        <span>Complete Registration & Join {orgName}</span>
                        <FiArrowRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        <span>Create Free WorkGrid Account</span>
                        <FiArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          {/* Security Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
              <span className="bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100 px-3 text-slate-400">
                Enterprise Cloud Security
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="w-full max-w-[520px] mx-auto pt-3 pb-2 border-t border-slate-200/60 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p>© 2026 WorkGrid Cloud. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/signin" className="hover:underline">Sign In</Link>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Visual Panel */}
      <div className="hidden lg:flex w-1/2 min-h-screen bg-gradient-to-br from-[#0F766E] via-[#115E59] to-[#042F2E] text-white px-10 py-6 lg:px-14 xl:px-18 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-teal-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-[500px] mx-auto my-auto space-y-7">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-teal-100">
            <FiCheck className="w-4 h-4 text-emerald-300" />
            {isInvitation
              ? `Workspace Invitation: ${isManagerRole ? "Manager Access" : "Team Member Access"}`
              : "Free plan available • No credit card required"}
          </div>

          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-bold leading-tight text-white tracking-tight">
            {isInvitation
              ? `Welcome aboard! Collaborate with your team on ${orgName}.`
              : "Plan, track, and manage all your team projects in one place."}
          </h2>
          <p className="text-teal-100/80 text-sm sm:text-base leading-relaxed">
            Customize your workflows, automate repetitive tasks, and unlock actionable insights with built-in WorkGrid agility.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-5 border-t border-white/10">
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-xs text-teal-200/70">Uptime SLA</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">3x</p>
              <p className="text-xs text-teal-200/70">Faster Releases</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">100k+</p>
              <p className="text-xs text-teal-200/70">Active Sprints</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[500px] mx-auto text-xs text-teal-200/60 shrink-0">
          Enterprise-grade security, role-based access control, and agile sprint tracking.
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
          Loading registration...
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}
