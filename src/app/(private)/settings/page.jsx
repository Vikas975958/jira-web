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
  FiImage,
  FiMapPin,
  FiLayers,
  FiInfo,
} from "react-icons/fi";
import { useOrganization } from "@/context/OrganizationContext";
import organizationService from "@/services/organization.service";
import { profileService } from "@/services/profile.service";
import { updateProfile } from "@/store/slices/authSlices";
import { OWNER_ROLE, MANAGER_ROLE, MEMBER_ROLE } from "@/utils/constants";

// Industry choices
const INDUSTRY_OPTIONS = [
  "Technology & Software",
  "Finance & Banking",
  "Healthcare & Life Sciences",
  "E-Commerce & Retail",
  "Education & EdTech",
  "Media & Entertainment",
  "Manufacturing & Supply Chain",
  "Consulting & Professional Services",
  "Real Estate & Construction",
  "Telecommunications",
  "Non-Profit",
  "Other",
];

// Company size options
const COMPANY_SIZE_OPTIONS = [
  "1-10 employees",
  "11-50 employees",
  "51-200 employees",
  "201-500 employees",
  "501-1000 employees",
  "1000+ employees",
];

// Common Timezones
const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST / EDT)" },
  { value: "America/Chicago", label: "America/Chicago (CST / CDT)" },
  { value: "America/Denver", label: "America/Denver (MST / MDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST / PDT)" },
  { value: "Europe/London", label: "Europe/London (GMT / BST)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET / CEST)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET / CEST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +4)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST +9)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST / AEDT)" },
];

// Common Currencies
const CURRENCY_OPTIONS = [
  { code: "USD", symbol: "$", label: "USD - US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "EUR - Euro (€)" },
  { code: "GBP", symbol: "£", label: "GBP - British Pound (£)" },
  { code: "INR", symbol: "₹", label: "INR - Indian Rupee (₹)" },
  { code: "CAD", symbol: "$", label: "CAD - Canadian Dollar ($)" },
  { code: "AUD", symbol: "$", label: "AUD - Australian Dollar ($)" },
  { code: "JPY", symbol: "¥", label: "JPY - Japanese Yen (¥)" },
  { code: "SGD", symbol: "$", label: "SGD - Singapore Dollar ($)" },
];

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
    logo_url: "",
    email: "",
    phone: "",
    website: "",
    industry: "Technology & Software",
    company_size: "1-10 employees",
    description: "",
    address: "",
    city: "",
    state: "",
    country: "United States",
    postal_code: "",
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
        logo_url: activeOrg.logo_url || "",
        email: activeOrg.email || "",
        phone: activeOrg.phone || "",
        website: activeOrg.website || "",
        industry: activeOrg.industry || "Technology & Software",
        company_size: activeOrg.company_size || "1-10 employees",
        description: activeOrg.description || "",
        address: activeOrg.address || "",
        city: activeOrg.city || "",
        state: activeOrg.state || "",
        country: activeOrg.country || "United States",
        postal_code: activeOrg.postal_code || "",
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
        logo_url: orgData.logo_url.trim() || null,
        email: orgData.email.trim() || null,
        phone: orgData.phone.trim() || null,
        website: orgData.website.trim() || null,
        industry: orgData.industry || null,
        company_size: orgData.company_size || null,
        description: orgData.description.trim() || null,
        address: orgData.address.trim() || null,
        city: orgData.city.trim() || null,
        state: orgData.state.trim() || null,
        country: orgData.country.trim() || null,
        postal_code: orgData.postal_code.trim() || null,
        timezone: orgData.timezone || "UTC",
        currency: orgData.currency || "USD",
      });
      await refreshOrganizations();
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
    }, 400);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto select-none">
      {/* Header */}
      <div className="pb-3.5 border-b border-slate-200">
        <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage your workspace configuration, account profile, and notifications.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("organization")}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "organization"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FiGlobe className="w-3.5 h-3.5" />
          <span>Workspace</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "profile"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FiUser className="w-3.5 h-3.5" />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "preferences"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <FiSliders className="w-3.5 h-3.5" />
          <span>Preferences</span>
        </button>
      </div>

      {/* TAB 1: ORGANIZATION / WORKSPACE SETTINGS */}
      {activeTab === "organization" && (
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-5">
          {/* Workspace Banner */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 text-[#0F766E] flex items-center justify-center font-bold text-sm shrink-0">
                {orgData.logo_url ? (
                  <img
                    src={orgData.logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover rounded-lg"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  orgData.name?.charAt(0)?.toUpperCase() || "W"
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {activeOrg?.name || "Your Workspace"}
                  </h3>
                  <span className="px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-teal-100 text-[#0F766E] border border-teal-200">
                    Active Workspace
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Single workspace mode • You can update your workspace details and branding below.
                </p>
              </div>
            </div>

            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 self-start sm:self-auto shrink-0">
              Role: {userRole === OWNER_ROLE ? "Workspace Owner" : userRole}
            </span>
          </div>

          {!isOwner && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
              <FiInfo className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                Workspace settings are in read-only mode for your role ({userRole}). Only the Workspace Owner can modify these settings.
              </span>
            </div>
          )}

          <form onSubmit={handleSaveOrg} className="space-y-5">
            {/* Section 1: General & Branding */}
            <div className="space-y-3.5">
              <div className="pb-1.5 border-b border-slate-100 flex items-center gap-2">
                <FiGlobe className="w-3.5 h-3.5 text-[#0F766E]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  General & Branding
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Workspace Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isOwner}
                    value={orgData.name}
                    onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Workspace Slug / URL Path
                  </label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={orgData.slug}
                    className="jira-input w-full text-xs h-8.5 px-3 bg-slate-50 text-slate-500 font-mono cursor-not-allowed"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">
                    Unique identifier used in URLs and member invitations.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  disabled={!isOwner}
                  value={orgData.logo_url}
                  onChange={(e) => setOrgData({ ...orgData, logo_url: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  disabled={!isOwner}
                  value={orgData.description}
                  onChange={(e) => setOrgData({ ...orgData, description: e.target.value })}
                  placeholder="Summary of this organization and team mission..."
                  className="jira-input w-full text-xs p-2.5 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                />
              </div>
            </div>

            {/* Section 2: Company Details & Contact */}
            <div className="space-y-3.5 pt-1">
              <div className="pb-1.5 border-b border-slate-100 flex items-center gap-2">
                <FiBriefcase className="w-3.5 h-3.5 text-purple-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Company Details & Contact
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Industry
                  </label>
                  <select
                    disabled={!isOwner}
                    value={orgData.industry}
                    onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                    className="jira-input w-full text-xs font-medium h-8.5 px-2.5 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {INDUSTRY_OPTIONS.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Company Size
                  </label>
                  <select
                    disabled={!isOwner}
                    value={orgData.company_size}
                    onChange={(e) => setOrgData({ ...orgData, company_size: e.target.value })}
                    className="jira-input w-full text-xs font-medium h-8.5 px-2.5 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {COMPANY_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Website URL
                  </label>
                  <input
                    type="url"
                    disabled={!isOwner}
                    value={orgData.website}
                    onChange={(e) => setOrgData({ ...orgData, website: e.target.value })}
                    placeholder="https://company.com"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    disabled={!isOwner}
                    value={orgData.email}
                    onChange={(e) => setOrgData({ ...orgData, email: e.target.value })}
                    placeholder="contact@company.com"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    disabled={!isOwner}
                    value={orgData.phone}
                    onChange={(e) => setOrgData({ ...orgData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Location & Localization */}
            <div className="space-y-3.5 pt-1">
              <div className="pb-1.5 border-b border-slate-100 flex items-center gap-2">
                <FiMapPin className="w-3.5 h-3.5 text-emerald-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Location & Localization
                </h3>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  disabled={!isOwner}
                  value={orgData.address}
                  onChange={(e) => setOrgData({ ...orgData, address: e.target.value })}
                  placeholder="100 Market St, Suite 400"
                  className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={orgData.city}
                    onChange={(e) => setOrgData({ ...orgData, city: e.target.value })}
                    placeholder="San Francisco"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    State / Province
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={orgData.state}
                    onChange={(e) => setOrgData({ ...orgData, state: e.target.value })}
                    placeholder="CA"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={orgData.country}
                    onChange={(e) => setOrgData({ ...orgData, country: e.target.value })}
                    placeholder="United States"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={orgData.postal_code}
                    onChange={(e) => setOrgData({ ...orgData, postal_code: e.target.value })}
                    placeholder="94105"
                    className="jira-input w-full text-xs h-8.5 px-3 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Workspace Timezone
                  </label>
                  <select
                    disabled={!isOwner}
                    value={orgData.timezone}
                    onChange={(e) => setOrgData({ ...orgData, timezone: e.target.value })}
                    className="jira-input w-full text-xs font-medium h-8.5 px-2.5 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Currency
                  </label>
                  <select
                    disabled={!isOwner}
                    value={orgData.currency}
                    onChange={(e) => setOrgData({ ...orgData, currency: e.target.value })}
                    className="jira-input w-full text-xs font-medium h-8.5 px-2.5 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {isOwner && (
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingOrg}
                  className="btn-primary px-4 py-1.5 text-xs font-semibold"
                >
                  <FiCheck className="w-3.5 h-3.5" />
                  <span>{savingOrg ? "Saving..." : "Save Workspace Settings"}</span>
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: PROFILE SETTINGS */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Personal Information
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Update your account details and contact preferences.
            </p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profileData.full_name}
                  onChange={(e) =>
                    setProfileData({ ...profileData, full_name: e.target.value })
                  }
                  className="jira-input w-full text-xs h-8.5 px-3"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profileData.email}
                  className="jira-input w-full text-xs h-8.5 px-3 bg-slate-50 text-slate-500 font-mono cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) =>
                  setProfileData({ ...profileData, phone: e.target.value })
                }
                placeholder="+1 (555) 000-0000"
                className="jira-input w-full max-w-sm text-xs h-8.5 px-3"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary px-4 py-1.5 text-xs font-semibold"
              >
                <FiCheck className="w-3.5 h-3.5" />
                <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: PREFERENCES */}
      {activeTab === "preferences" && (
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Notification Preferences
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose what notifications and updates you receive.
            </p>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-3">
            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E]"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">
                    Task Assignments & Mentions
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Receive instant notifications when an issue is assigned to you or you are mentioned.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200/80 hover:bg-slate-50/70 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={sprintDigest}
                  onChange={(e) => setSprintDigest(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#0F766E] focus:ring-[#0F766E]"
                />
                <div>
                  <p className="text-xs font-semibold text-slate-800">
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
                className="btn-primary px-4 py-1.5 text-xs font-semibold"
              >
                <FiCheck className="w-3.5 h-3.5" />
                <span>{savingPrefs ? "Saving..." : "Save Preferences"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
