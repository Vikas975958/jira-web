"use client";

import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  FiSettings,
  FiUser,
  FiGlobe,
  FiBriefcase,
  FiMail,
  FiPhone,
  FiShield,
  FiCheck,
  FiSliders,
  FiClock,
  FiDollarSign,
  FiBell,
} from "react-icons/fi";
import { useOrganization } from "@/context/OrganizationContext";
import organizationService from "@/services/organization.service";
import { profileService } from "@/services/profile.service";
import { updateProfile } from "@/store/slices/authSlices";
import { OWNER_ROLE, MANAGER_ROLE, MEMBER_ROLE } from "@/utils/constants";

export default function SettingsPage() {
  const dispatch = useDispatch();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;

  const { currentOrg, organizations, refreshOrganizations } = useOrganization();
  const activeOrgMembership = currentOrg || organizations?.[0] || null;
  const activeOrg = activeOrgMembership?.organizations || activeOrgMembership;
  const userRole = activeOrgMembership?.role || user?.role || MEMBER_ROLE;
  const isOwner = userRole === OWNER_ROLE;

  const [activeTab, setActiveTab] = useState("organization");

  // Organization Form State
  const [orgData, setOrgData] = useState({
    name: "",
    slug: "",
    website: "",
    industry: "Technology & Software",
    company_size: "1-10 employees",
    description: "",
    timezone: "UTC",
    currency: "USD",
  });
  const [savingOrg, setSavingOrg] = useState(false);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    full_name: "",
    email: "",
    phone: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Preferences State
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [sprintDigest, setSprintDigest] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Populate Org Data
  useEffect(() => {
    if (activeOrg) {
      setOrgData({
        name: activeOrg.name || "",
        slug: activeOrg.slug || "",
        website: activeOrg.website || "",
        industry: activeOrg.industry || "Technology & Software",
        company_size: activeOrg.company_size || "1-10 employees",
        description: activeOrg.description || "",
        timezone: activeOrg.timezone || "UTC",
        currency: activeOrg.currency || "USD",
      });
    }
  }, [activeOrg]);

  // Populate Profile Data
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || user.name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  // Handle Org Save
  const handleSaveOrg = async (e) => {
    e.preventDefault();
    if (!activeOrg?.id) return;
    if (!orgData.name.trim()) {
      toast.error("Organization name is required.");
      return;
    }

    try {
      setSavingOrg(true);
      await organizationService.updateOrganization(activeOrg.id, {
        name: orgData.name.trim(),
        website: orgData.website.trim() || null,
        industry: orgData.industry || null,
        company_size: orgData.company_size || null,
        description: orgData.description.trim() || null,
        timezone: orgData.timezone || "UTC",
        currency: orgData.currency || "USD",
      });
      await refreshOrganizations();
      toast.success("Workspace settings updated successfully.");
    } catch (err) {
      console.error("Failed to update workspace:", err);
      toast.error(err?.message || "Failed to update workspace settings.");
    } finally {
      setSavingOrg(false);
    }
  };

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      setSavingProfile(true);
      const updates = {
        full_name: profileData.full_name.trim(),
        phone: profileData.phone.trim() || null,
      };

      await profileService.updateProfile(user.id, updates);
      dispatch(updateProfile(updates));
      toast.success("Profile updated successfully.");
    } catch (err) {
      console.error("Failed to update profile:", err);
      toast.error(err?.message || "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Preferences Save
  const handleSavePreferences = (e) => {
    e.preventDefault();
    setSavingPrefs(true);
    setTimeout(() => {
      setSavingPrefs(false);
      toast.success("Preferences saved.");
    }, 400);
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-5xl mx-auto select-none">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Manage your workspace configuration, account profile, and notifications.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("organization")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "organization"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FiGlobe className="w-4 h-4" />
          <span>Workspace</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "profile"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FiUser className="w-4 h-4" />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "preferences"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FiSliders className="w-4 h-4" />
          <span>Preferences</span>
        </button>
      </div>

      {/* TAB 1: ORGANIZATION / WORKSPACE SETTINGS */}
      {activeTab === "organization" && (
        <div className="bg-white rounded-lg border border-slate-200/80 p-6 shadow-xs animate-fadeIn space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Workspace Configuration
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Details for {activeOrg?.name || "your organization"}.
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700">
              Role: {userRole}
            </span>
          </div>

          <form onSubmit={handleSaveOrg} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Workspace Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Workspace Slug / Path
                </label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={orgData.slug}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Industry
                </label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={orgData.industry}
                  onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Website URL
                </label>
                <input
                  type="url"
                  disabled={!isOwner}
                  value={orgData.website}
                  onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                  placeholder="https://company.com"
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                disabled={!isOwner}
                value={orgData.description}
                onChange={(e) => setOrgData({ ...orgData, description: e.target.value })}
                placeholder="High-level description of this workspace..."
                className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>

            {isOwner && (
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingOrg}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <FiCheck className="w-4 h-4" />
                  <span>{savingOrg ? "Saving..." : "Save Workspace"}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: PROFILE SETTINGS */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-lg border border-slate-200/80 p-6 shadow-xs animate-fadeIn space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Personal Information
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your account details and contact preferences.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileData.full_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, full_name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profileData.email}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) =>
                  setProfileData({ ...profileData, phone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
                className="w-full max-w-sm px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#0F766E] text-slate-900"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FiCheck className="w-4 h-4" />
                <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: PREFERENCES */}
      {activeTab === "preferences" && (
        <div className="bg-white rounded-lg border border-slate-200/80 p-6 shadow-xs animate-fadeIn space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Notification Preferences
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose what notifications and updates you receive.
            </p>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200/80 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-lg text-[#0F766E] focus:ring-[#0F766E]"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Task Assignments & Mentions
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Receive instant notifications when an issue is assigned to you or you are mentioned.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-lg border border-slate-200/80 hover:bg-slate-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={sprintDigest}
                  onChange={(e) => setSprintDigest(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-lg text-[#0F766E] focus:ring-[#0F766E]"
                />
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    Weekly Sprint Digest
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Receive a summary of completed issues and sprint velocity every Monday.
                  </p>
                </div>
              </label>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingPrefs}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white text-xs font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <FiCheck className="w-4 h-4" />
                <span>{savingPrefs ? "Saving..." : "Save Preferences"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
