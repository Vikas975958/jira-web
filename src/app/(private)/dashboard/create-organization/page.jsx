"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  FiGlobe,
  FiArrowLeft,
  FiArrowRight,
  FiCheck,
  FiBriefcase,
  FiUsers,
  FiMapPin,
  FiMail,
  FiPhone,
  FiClock,
  FiDollarSign,
  FiImage,
  FiFileText,
  FiInfo,
  FiLayers,
  FiZap,
} from "react-icons/fi";
import organizationService, { slugify } from "@/services/organization.service";
import { OWNER_ROLE } from "@/utils/constants";
import { useOrganization } from "@/context/OrganizationContext";
import JiraLogo from "@/components/JiraLogo";

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

export default function CreateOrganizationPage() {
  const router = useRouter();
  const authState = useSelector((state) => state.authSlice);
  const user = authState?.userData;
  const { hasOrganization, loadingOrgs, refreshOrganizations } = useOrganization();

  // If user already has an active organization, redirect immediately to dashboard
  useEffect(() => {
    if (!loadingOrgs && hasOrganization) {
      toast.info("You already have an active workspace. You can edit it in Settings.");
      router.replace("/dashboard");
    }
  }, [hasOrganization, loadingOrgs, router]);

  const [activeTab, setActiveTab] = useState("general"); // 'general' | 'company' | 'location'
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
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
    status: "active",
  });

  // Auto-generate slug when name changes unless user customized it
  useEffect(() => {
    if (!slugManuallyEdited && formData.name) {
      const generatedSlug = slugify(formData.name);
      setFormData((prev) => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.name, slugManuallyEdited]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "slug") {
      setSlugManuallyEdited(true);
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlugBlur = () => {
    setFormData((prev) => ({ ...prev, slug: slugify(prev.slug) }));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg("");

    if (hasOrganization) {
      setErrorMsg("You already have an active workspace. Multiple workspaces are not allowed.");
      toast.error("You already have an active workspace.");
      router.replace("/dashboard");
      return;
    }

    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      setErrorMsg("Please enter an organization name.");
      setActiveTab("general");
      return;
    }

    if (trimmedName.length < 2) {
      setErrorMsg("Organization name must be at least 2 characters.");
      setActiveTab("general");
      return;
    }

    if (!user?.id) {
      setErrorMsg("You must be logged in to create an organization.");
      return;
    }

    setLoading(true);

    try {
      const finalSlug = slugify(formData.slug) || slugify(trimmedName);

      // 1. Create Organization with all fields
      const org = await organizationService.createOrganization({
        name: trimmedName,
        slug: finalSlug,
        logo_url: formData.logo_url?.trim() || null,
        email: formData.email?.trim() || null,
        phone: formData.phone?.trim() || null,
        website: formData.website?.trim() || null,
        industry: formData.industry || null,
        company_size: formData.company_size || null,
        description: formData.description?.trim() || null,
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        country: formData.country?.trim() || null,
        postal_code: formData.postal_code?.trim() || null,
        timezone: formData.timezone || "UTC",
        currency: formData.currency || "USD",
        status: formData.status || "active",
        created_by: user.id,
      });

      // 2. Add creator as owner member
      await organizationService.addMember({
        organizationId: org.id,
        userId: user.id,
        role: OWNER_ROLE,
      });

      if (refreshOrganizations) {
        await refreshOrganizations();
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Create organization error:", err);
      const message =
        err?.message || "Failed to create organization. Please try again.";
      setErrorMsg(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingOrgs) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
        <div className="w-5 h-5 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin mr-2.5" />
        Loading workspace information...
      </div>
    );
  }

  if (hasOrganization) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 text-sm space-y-3">
        <div className="w-5 h-5 border-2 border-[#0F766E] border-t-transparent rounded-full animate-spin" />
        <p>You already have an active workspace. Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/70 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <JiraLogo className="w-6 h-6" textColor="text-slate-900" />
            <div className="h-4 w-px bg-slate-300" />
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors group cursor-pointer"
            >
              <FiArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              <span>Back to Dashboard</span>
            </button>
          </div>

          <span className="text-[10px] font-semibold px-2 py-0.5 bg-teal-50 text-[#0F766E] rounded-md border border-teal-200">
            WorkGrid Workspace Setup
          </span>
        </div>

        {/* Page Title & Intro */}
        <div className="bg-white rounded-lg border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200/70 text-[#0F766E] flex items-center justify-center font-bold shrink-0">
              <FiGlobe className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Create Organization
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure your company workspace, branding, team defaults, and localization.
              </p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
            <span className="text-sm mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="font-bold">Error creating organization</p>
              <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Main Content Grid: Form (left) + Live Preview (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Form: Tabs & Fields */}
          <div className="lg:col-span-2 space-y-4">
            {/* Step Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-t-lg px-3 pt-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "general"
                    ? "border-[#0F766E] text-[#0F766E]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FiInfo className="w-3.5 h-3.5" />
                <span>1. General Info</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("company")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "company"
                    ? "border-[#0F766E] text-[#0F766E]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FiBriefcase className="w-3.5 h-3.5" />
                <span>2. Company Details</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("location")}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  activeTab === "location"
                    ? "border-[#0F766E] text-[#0F766E]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FiMapPin className="w-3.5 h-3.5" />
                <span>3. Location & Localization</span>
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleSubmit} className="bg-white rounded-b-lg border border-t-0 border-slate-200/80 p-5 sm:p-6 space-y-5 shadow-2xs">
              {/* TAB 1: GENERAL INFO */}
              {activeTab === "general" && (
                <div className="space-y-4">
                  {/* Organization Name */}
                  <div>
                    <label
                      htmlFor="org-name"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <FiGlobe className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="org-name"
                        name="name"
                        type="text"
                        required
                        autoFocus
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. Acme Corporation"
                        className="jira-input w-full h-8.5 !pl-9 pr-3 text-xs"
                      />
                    </div>
                  </div>

                  {/* Slug / Workspace URL */}
                  <div>
                    <label
                      htmlFor="org-slug"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Organization Slug (Workspace URL) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex rounded-lg border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-[#0F766E] focus-within:border-transparent">
                      <span className="inline-flex items-center px-3 bg-slate-50 text-slate-500 text-xs font-mono border-r border-slate-200">
                        workgrid.web/org/
                      </span>
                      <input
                        id="org-slug"
                        name="slug"
                        type="text"
                        required
                        value={formData.slug}
                        onChange={handleChange}
                        onBlur={handleSlugBlur}
                        placeholder="acme-corp"
                        className="flex-1 h-8.5 px-3 bg-white text-slate-900 text-xs font-mono focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Unique identifier used in URLs and member invitations.
                    </p>
                  </div>

                  {/* Logo URL */}
                  <div>
                    <label
                      htmlFor="logo_url"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Logo Image URL <span className="text-slate-400 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <FiImage className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="logo_url"
                        name="logo_url"
                        type="url"
                        value={formData.logo_url}
                        onChange={handleChange}
                        placeholder="https://example.com/logo.png"
                        className="jira-input w-full h-8.5 !pl-9 pr-3 text-xs"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Brief summary of your company, mission, or projects..."
                      className="jira-input w-full p-2.5 text-xs resize-none"
                    />
                  </div>

                  {/* Actions: Direct Create or Continue */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab("company")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-[#0F766E] transition-colors cursor-pointer"
                    >
                      <span>Configure Company Details →</span>
                    </button>

                    <button
                      type="submit"
                      disabled={loading || !formData.name.trim()}
                      className="btn-primary px-4 py-1.5 text-xs font-semibold"
                    >
                      {loading ? "Creating..." : "Create Organization"}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANY DETAILS */}
              {activeTab === "company" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Industry */}
                    <div>
                      <label
                        htmlFor="industry"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Industry
                      </label>
                      <select
                        id="industry"
                        name="industry"
                        value={formData.industry}
                        onChange={handleChange}
                        className="jira-input w-full text-xs font-medium h-8.5 px-2.5"
                      >
                        {INDUSTRY_OPTIONS.map((ind) => (
                          <option key={ind} value={ind}>
                            {ind}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Company Size */}
                    <div>
                      <label
                        htmlFor="company_size"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Company Size
                      </label>
                      <select
                        id="company_size"
                        name="company_size"
                        value={formData.company_size}
                        onChange={handleChange}
                        className="jira-input w-full text-xs font-medium h-8.5 px-2.5"
                      >
                        {COMPANY_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Website */}
                  <div>
                    <label
                      htmlFor="website"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Website URL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <FiGlobe className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="website"
                        name="website"
                        type="url"
                        value={formData.website}
                        onChange={handleChange}
                        placeholder="https://acme.com"
                        className="jira-input w-full h-8.5 !pl-9 pr-3 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Work Email */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Contact / Support Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <FiMail className="w-3.5 h-3.5" />
                        </div>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="contact@acme.com"
                          className="jira-input w-full h-8.5 !pl-9 pr-3 text-xs"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Phone Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <FiPhone className="w-3.5 h-3.5" />
                        </div>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+1 (555) 000-0000"
                          className="jira-input w-full h-8.5 !pl-9 pr-3 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab("general")}
                      className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                    >
                      ← Back to General
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("location")}
                      className="btn-primary px-4 py-1.5 text-xs font-semibold"
                    >
                      <span>Continue to Localization</span>
                      <FiArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: LOCATION & LOCALIZATION */}
              {activeTab === "location" && (
                <div className="space-y-4">
                  {/* Address */}
                  <div>
                    <label
                      htmlFor="address"
                      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                    >
                      Street Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <FiMapPin className="w-3.5 h-3.5" />
                      </div>
                      <input
                        id="address"
                        name="address"
                        type="text"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="100 Market St, Suite 400"
                        className="jira-input w-full h-8.5 !pl-9 pr-3 text-xs"
                      />
                    </div>
                  </div>

                  {/* City, State, Country, Postal Code */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label
                        htmlFor="city"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        City
                      </label>
                      <input
                        id="city"
                        name="city"
                        type="text"
                        value={formData.city}
                        onChange={handleChange}
                        placeholder="San Francisco"
                        className="jira-input w-full h-8.5 px-3 text-xs"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="state"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        State / Province
                      </label>
                      <input
                        id="state"
                        name="state"
                        type="text"
                        value={formData.state}
                        onChange={handleChange}
                        placeholder="CA"
                        className="jira-input w-full h-8.5 px-3 text-xs"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="country"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Country
                      </label>
                      <input
                        id="country"
                        name="country"
                        type="text"
                        value={formData.country}
                        onChange={handleChange}
                        placeholder="United States"
                        className="jira-input w-full h-8.5 px-3 text-xs"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="postal_code"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Postal Code
                      </label>
                      <input
                        id="postal_code"
                        name="postal_code"
                        type="text"
                        value={formData.postal_code}
                        onChange={handleChange}
                        placeholder="94105"
                        className="jira-input w-full h-8.5 px-3 text-xs"
                      />
                    </div>
                  </div>

                  {/* Timezone & Currency */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    {/* Timezone */}
                    <div>
                      <label
                        htmlFor="timezone"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Workspace Timezone
                      </label>
                      <select
                        id="timezone"
                        name="timezone"
                        value={formData.timezone}
                        onChange={handleChange}
                        className="jira-input w-full text-xs font-medium h-8.5 px-2.5"
                      >
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Currency */}
                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-[11px] font-semibold uppercase tracking-wider text-slate-700 mb-1"
                      >
                        Billing & Project Currency
                      </label>
                      <select
                        id="currency"
                        name="currency"
                        value={formData.currency}
                        onChange={handleChange}
                        className="jira-input w-full text-xs font-medium h-8.5 px-2.5"
                      >
                        {CURRENCY_OPTIONS.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-3 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab("company")}
                      className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                    >
                      ← Back to Company Details
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !formData.name.trim()}
                      className="btn-primary px-5 py-2 text-xs font-semibold"
                    >
                      {loading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Creating Organization...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Organization</span>
                          <FiArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Live Workspace Preview Card */}
          <div className="lg:col-span-1 space-y-4">
            <div className="sticky top-20 bg-white rounded-lg border border-slate-200/80 shadow-2xs overflow-hidden">
              {/* Card Header Banner */}
              <div className="h-16 bg-[#0F766E] relative p-3 flex items-end">
                <span className="text-[10px] uppercase font-semibold text-white/90 tracking-wider bg-black/20 px-2 py-0.2 rounded-md">
                  Live Preview
                </span>
              </div>

              {/* Avatar & Org Info */}
              <div className="px-5 pb-5 pt-0 relative">
                <div className="-mt-8 mb-2.5 flex items-end justify-between">
                  <div className="w-14 h-14 rounded-lg bg-white p-1 border border-slate-200 shadow-sm">
                    {formData.logo_url ? (
                      <img
                        src={formData.logo_url}
                        alt="Logo"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                        className="w-full h-full object-cover rounded-md"
                      />
                    ) : (
                      <div className="w-full h-full rounded-md bg-teal-50 border border-teal-200 text-[#0F766E] flex items-center justify-center text-lg font-bold">
                        {formData.name?.charAt(0)?.toUpperCase() || "O"}
                      </div>
                    )}
                  </div>
                  <span className="px-2 py-0.2 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 leading-tight">
                  {formData.name || "Acme Corporation"}
                </h3>
                <p className="text-[11px] font-mono text-[#0F766E] mt-0.5">
                  workgrid.web/org/{formData.slug || "acme-corp"}
                </p>

                {formData.description ? (
                  <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">
                    {formData.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic mt-1.5">
                    No description provided yet.
                  </p>
                )}

                {/* Metadata items */}
                <div className="mt-3.5 pt-3.5 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <FiBriefcase className="w-3.5 h-3.5" />
                      Industry
                    </span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {formData.industry || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <FiUsers className="w-3.5 h-3.5" />
                      Team Size
                    </span>
                    <span className="font-semibold text-slate-800 text-[11px]">
                      {formData.company_size || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <FiClock className="w-3.5 h-3.5" />
                      Timezone
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">
                      {formData.timezone || "UTC"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <FiDollarSign className="w-3.5 h-3.5" />
                      Currency
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">
                      {formData.currency || "USD"}
                    </span>
                  </div>

                  {formData.city && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <FiMapPin className="w-3.5 h-3.5" />
                        Location
                      </span>
                      <span className="font-semibold text-slate-800 text-[11px]">
                        {formData.city}{formData.country ? `, ${formData.country}` : ""}
                      </span>
                    </div>
                  )}

                  {formData.website && (
                    <div className="flex items-center justify-between text-slate-600 pt-0.5">
                      <span className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                        <FiGlobe className="w-3.5 h-3.5" />
                        Website
                      </span>
                      <span className="font-semibold text-[#0F766E] truncate max-w-[140px] text-[11px]">
                        {formData.website.replace(/^https?:\/\//, "")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Creator badge */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Workspace Creator</span>
                  <span className="font-semibold text-slate-700 bg-slate-50 px-2 py-0.2 rounded-md border border-slate-200">
                    Owner Role
                  </span>
                </div>
              </div>
            </div>

            {/* Included Features */}
            <div className="bg-white rounded-lg border border-slate-200/80 p-4 space-y-2.5 shadow-2xs">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Included in Your Workspace
              </h4>
              <ul className="text-xs text-slate-600 space-y-1.5">
                <li className="flex items-center gap-2">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Kanban & Scrum sprint boards</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Role-based access (Owner, Manager, Member)</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Workspace settings & member invitations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
