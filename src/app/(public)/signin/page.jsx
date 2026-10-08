"use client";

import React, { useState } from "react";
import Link from "next/link";
import { toast } from "react-toastify";
import {
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiCheckCircle,
} from "react-icons/fi";
import JiraLogo from "@/components/JiraLogo";
import { useAuth } from "@/hooks/useAuth";

export default function SignInPage() {
  const { signIn, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email.trim() || !password.trim()) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    try {
      await signIn({ email: email.trim(), password });
    } catch (err) {
      const message =
        err?.message === "Invalid login credentials"
          ? "Invalid email or password. Please try again or create an account."
          : err?.message || "Failed to sign in. Please check your credentials.";
      setErrorMsg(message);
    }
  };

  const handleQuickDemoFill = () => {
    setEmail("developer@jira.internal");
    setPassword("JiraDemo2026!");
  };

  return (
    <div className="h-screen w-full flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 text-slate-800 overflow-hidden select-none">
      {/* Left Column: Sign In Form */}
      <div className="w-full lg:w-1/2 h-full flex flex-col justify-between px-6 py-6 sm:px-10 lg:px-14 xl:px-16 overflow-hidden">
        {/* Brand Header */}
        <div className="w-full max-w-[500px] mx-auto flex items-center justify-between shrink-0">
          <JiraLogo className="w-9 h-9" textColor="text-slate-900" />
          <Link
            href="/signup"
            className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
          >
            Sign up for an account →
          </Link>
        </div>

        {/* Center Form Container */}
        <div className="w-full max-w-[500px] mx-auto my-auto flex flex-col justify-center">
          {/* Form Header */}
          <div className="mb-6">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Sign in to your account
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-500 leading-relaxed">
              Access your agile boards, sprint reports, and ongoing team roadmaps.
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-3 animate-fadeIn">
              <span className="text-base">⚠️</span>
              <div className="flex-1">
                <p className="font-semibold">Sign in failed</p>
                <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-600 mb-1.5"
              >
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiMail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs sm:text-[13px] font-bold uppercase tracking-wider text-slate-600"
                >
                  Password
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Password reset link will be sent to your email.");
                  }}
                  className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-800"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <FiLock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <FiEyeOff className="w-5 h-5" />
                  ) : (
                    <FiEye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs sm:text-sm text-slate-600">Keep me signed in</span>
              </label>

              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="text-xs sm:text-sm font-medium text-slate-500 hover:text-blue-600 underline decoration-dotted cursor-pointer"
              >
                Autofill test demo
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 px-5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in with Supabase...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <FiArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Social / Security Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
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
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
            <a href="#" className="hover:underline">Help</a>
          </div>
        </div>
      </div>

      {/* Right Column: Hero Visual Panel */}
      <div className="hidden lg:flex w-1/2 h-full bg-gradient-to-br from-[#0052CC] via-[#0747A6] to-[#091E42] text-white px-10 py-6 lg:px-14 xl:px-18 flex-col justify-between relative overflow-hidden">
        {/* Glows */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Center Content */}
        <div className="relative z-10 w-full max-w-[500px] mx-auto my-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-blue-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            Active Sprint 24 • Engineering & Product
          </div>

          <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-black leading-tight text-white tracking-tight">
            Move fast, stay aligned, and deliver great software.
          </h2>
          <p className="text-blue-100/80 text-sm sm:text-base leading-relaxed">
            The #1 software development tool used by agile teams. Track bugs, plan sprints, and visualize workflows in real-time.
          </p>

          {/* Feature List */}
          <div className="space-y-3 pt-1">
            {[
              "Interactive Kanban & Scrum board workflows",
              "Instant Supabase user registration and login",
              "Enterprise-grade session management with Redux",
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm sm:text-base text-blue-100">
                <FiCheckCircle className="w-5 h-5 text-emerald-300 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 w-full max-w-[500px] mx-auto text-xs text-blue-200/60 shrink-0">
          Crafted for high performance agile engineering teams.
        </div>
      </div>
    </div>
  );
}
