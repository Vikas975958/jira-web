"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  FiSearch,
  FiBell,
  FiHelpCircle,
  FiSettings,
  FiLogOut,
  FiUser,
  FiPlus,
  FiGrid,
  FiChevronDown,
  FiCheck,
} from "react-icons/fi";
import JiraLogo from "./JiraLogo";
import LogoutConfirmModal from "./LogoutConfirmModal";
import Cookies from "js-cookie";
import authService from "@/services/authService";
import { emptyStore } from "@/store/rootReducer";
import { getNameInitials } from "@/utils/commonFunction";

export default function Header({ onCreateIssueClick }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    setDropdownOpen(false);
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authService.signOut();
      Cookies.remove("token", { path: "/" });
      dispatch(emptyStore());
      toast.info("You have been signed out.");
      setIsLogoutModalOpen(false);
      router.push("/signin");
    } catch (err) {
      console.error("Logout error:", err);
      Cookies.remove("token", { path: "/" });
      dispatch(emptyStore());
      setIsLogoutModalOpen(false);
      router.push("/signin");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const userName = user?.name || user?.email?.split("@")[0] || "Team Member";
  const userInitials = getNameInitials(userName) || "U";
  const userRole = user?.role || "Software Engineer";

  return (
    <header className="h-14 border-b border-slate-200 bg-white sticky top-0 z-40 px-3 md:px-5 flex items-center justify-between shadow-xs select-none">
      {/* Left side: Logo & Navigation items */}
      <div className="flex items-center gap-4 lg:gap-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <JiraLogo className="w-7 h-7" textColor="text-slate-900" />
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-700">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1 transition-colors text-blue-700 font-semibold"
          >
            Your Work
          </Link>
          <button className="px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1 transition-colors text-slate-700">
            Projects <FiChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button className="px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1 transition-colors text-slate-700">
            Filters <FiChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button className="px-3 py-1.5 rounded-md hover:bg-slate-100 flex items-center gap-1 transition-colors text-slate-700">
            Dashboards <FiChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
          <button className="hidden xl:flex px-3 py-1.5 rounded-md hover:bg-slate-100 items-center gap-1 transition-colors text-slate-700">
            Teams <FiChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </nav>

        {/* Jira Famous Primary Create Button */}
        <button
          onClick={onCreateIssueClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-95 text-white text-xs md:text-sm font-semibold rounded-md shadow-sm transition-all cursor-pointer"
        >
          <FiPlus className="w-4 h-4" />
          <span>Create</span>
        </button>
      </div>

      {/* Right side: Search, Notifications, User menu */}
      <div className="flex items-center gap-2 sm:gap-3" ref={dropdownRef}>
        {/* Global Search */}
        <div className="relative hidden sm:block w-44 md:w-64">
          <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Jira..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200/70 focus:bg-white border border-transparent focus:border-blue-500 rounded-md outline-none transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Notification Bell */}
        <button
          onClick={() => setNotificationsOpen(!notificationsOpen)}
          className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          title="Notifications"
        >
          <FiBell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        {/* Settings button */}
        <button
          onClick={() => toast.info("Settings modal opens project configuration.")}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors hidden sm:block cursor-pointer"
          title="Settings"
        >
          <FiSettings className="w-4 h-4" />
        </button>

        {/* Help button */}
        <button
          onClick={() => toast.info("Jira Documentation & Keyboard Shortcuts (Press '?' anytime)")}
          className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors hidden sm:block cursor-pointer"
          title="Help"
        >
          <FiHelpCircle className="w-4 h-4" />
        </button>

        {/* User Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-full hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {userInitials}
            </div>
          </button>

          {/* User Menu Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn text-xs">
              {/* Profile Card */}
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="font-bold text-sm text-slate-900 truncate">{userName}</p>
                <p className="text-slate-500 truncate text-[11px]">{user?.email || "developer@jira.internal"}</p>
                <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium text-[10px]">
                  <FiCheck className="w-3 h-3" />
                  {userRole}
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                <button
                  onClick={() => {
                    toast.info(`Viewing profile for ${userName}`);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                >
                  <FiUser className="w-4 h-4 text-slate-400" />
                  <span>Profile & Preferences</span>
                </button>
                <button
                  onClick={() => {
                    toast.info("Connected via Supabase Authentication");
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700"
                >
                  <FiGrid className="w-4 h-4 text-slate-400" />
                  <span>Supabase Auth Session</span>
                </button>
              </div>

              {/* Logout Button */}
              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogoutClick}
                  className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2.5 font-semibold transition-colors cursor-pointer"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Log out of Jira</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
        user={user}
      />
    </header>
  );
}
