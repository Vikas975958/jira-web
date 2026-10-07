"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  FiUser,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiCheck,
  FiBriefcase,
  FiShield,
  FiZap,
} from "react-icons/fi";
import JiraLogo from "@/components/JiraLogo";
import authService from "@/services/authService";
import { logingAuth } from "@/store/slices/authSlices";

export default function SignUpPage() {
  const router = useRouter();
  const dispatch = useDispatch();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Software Engineer");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successConfirmation, setSuccessConfirmation] = useState(false);



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

    setLoading(true);

    try {
      const data = await authService.signUp({
        email,
        password,
        fullName: fullName.trim(),
      });

      const user = data?.user;
      const session = data?.session;

      if (session) {
        dispatch(
          logingAuth({
            token: session.access_token,
            userId: user.id,
            userData: {
              id: user.id,
              email: user.email,
              name: fullName.trim(),
              role,
            },
            role,
          })
        );
        toast.success("Account created and signed in! Welcome to Jira.");
        router.push("/dashboard");
      } else {
        setSuccessConfirmation(true);
        toast.success("Account created successfully! Check your email if verification is required.");
      }
    } catch (err) {
      console.error("Sign-up error:", err);
      const message = err?.message || "Failed to create account. Please try again.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 text-slate-800 overflow-hidden select-none">
      {/* Left Column: Form (Scaled up size, strictly 100vh) */}
      <div className="w-full lg:w-1/2 h-full flex flex-col justify-between px-6 py-5 sm:px-10 lg:px-14 xl:px-16 overflow-hidden">
        {/* Brand Header */}
        <div className="w-full max-w-[500px] mx-auto flex items-center justify-between shrink-0">
          <JiraLogo className="w-9 h-9" textColor="text-slate-900" />
          <Link
            href="/signin"
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Already have an account? Sign In →
          </Link>
        </div>

        {/* Center Content Container */}
        <div className="w-full max-w-[500px] mx-auto my-auto flex flex-col justify-center">
          {/* Form Header */}
          <div className="mb-4">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Create your Jira account
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Get started with sprint planning, issue tracking, and real-time agility.
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-2.5 animate-fadeIn">
              <span className="text-sm">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold">Registration notice</p>
                <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Email verification notice */}
          {successConfirmation ? (
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                  ✓
                </div>
                <div>
                  <h3 className="font-bold text-base">Account Created!</h3>
                  <p className="text-xs text-emerald-700">
                    A confirmation link has been sent to <b>{email}</b>.
                  </p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
                You can now proceed to the Sign In page with your credentials.
              </p>
              <div className="pt-1">
                <Link
                  href="/signin"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all shadow-sm"
                >
                  Proceed to Sign In
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="fullName"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    Full Name
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
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="role"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    Role
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <FiBriefcase className="w-4 h-4" />
                    </div>
                    <select
                      id="role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full h-11 pl-10 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs cursor-pointer"
                    >
                      <option value="Software Engineer">Software Engineer</option>
                      <option value="Tech Lead">Tech Lead</option>
                      <option value="Product Manager">Product Manager</option>
                      <option value="Scrum Master">Scrum Master</option>
                      <option value="QA Engineer">QA Engineer</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                >
                  Work Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <FiMail className="w-4 h-4" />
                  </div>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="signup-password"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    Password
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
                      placeholder="6+ chars"
                      className="w-full h-11 pl-10 pr-9 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
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
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1"
                  >
                    Confirm
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
                      className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                    />
                  </div>
                </div>
              </div>



              <div className="pt-0.5">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600 leading-tight">
                    I agree to Jira Cloud Terms of Service and Privacy Policy.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 px-5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.99] text-white font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Create Free Jira Account</span>
                    <FiArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Social / Security Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-semibold">
              <span className="bg-slate-50 px-3 text-slate-400">
                Enterprise Cloud Security
              </span>
            </div>
          </div>


        </div>

        {/* Footer info */}
        <div className="w-full max-w-[500px] mx-auto pt-3 border-t border-slate-200/60 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <p>© 2026 Atlassian Jira Cloud Replica. Powered by Supabase Auth.</p>
          <div className="flex gap-4">
            <Link href="/signin" className="hover:underline">Sign In</Link>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Visual Panel */}
      <div className="hidden lg:flex w-1/2 h-full bg-gradient-to-br from-[#0052CC] via-[#0747A6] to-[#091E42] text-white px-10 py-6 lg:px-14 xl:px-18 flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

    
        <div className="relative z-10 w-full max-w-[500px] mx-auto my-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-blue-100">
            <FiCheck className="w-4 h-4 text-emerald-300" />
            Free plan available • No credit card required
          </div>

          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-black leading-tight text-white tracking-tight">
            Plan, track, and manage all your team projects in one place.
          </h2>
          <p className="text-blue-100/80 text-sm sm:text-base leading-relaxed">
            Customize your workflows, automate repetitive tasks, and unlock actionable insights with built-in Jira agility.
          </p>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-2xl font-bold text-white">99.9%</p>
              <p className="text-xs text-blue-200/70">Uptime SLA</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">3x</p>
              <p className="text-xs text-blue-200/70">Faster Releases</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">100k+</p>
              <p className="text-xs text-blue-200/70">Active Sprints</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 w-full max-w-[500px] mx-auto text-xs text-blue-200/60 shrink-0">
          Powered by Supabase Authentication & Realtime PostgreSQL.
        </div>
      </div>
    </div>
  );
}
