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
  const { refreshOrganizations } = useOrganization();

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

      await refreshOrganizations();

      toast.success(`Organization "${trimmedName}" created successfully!`);
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

  return (
    <div className="min-h-screen bg-slate-50/80 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors group cursor-pointer"
          >
            <FiArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to Dashboard</span>
          </button>

          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
            Jira Workspace Setup
          </span>
        </div>

        {/* Page Title & Intro */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#0747A6] flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
                <FiGlobe className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                  Create Organization
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  Configure your company workspace, branding, team defaults, and localization.
                </p>
              </div>
            </div>

            {/* Quick Create shortcut */}
            <button
              type="button"
              disabled={loading || !formData.name.trim()}
              onClick={() => handleSubmit()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer self-start md:self-auto shrink-0"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <FiCheck className="w-4 h-4" />
                  <span>Create Organization</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 animate-fadeIn">
            <span className="text-base mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="font-bold">Error creating organization</p>
              <p className="text-xs text-red-600 mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Main Content Grid: Form (left) + Live Preview (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Form: Tabs & Fields */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab("general")}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "general"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FiInfo className="w-4 h-4" />
                <span>1. General Info</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("company")}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "company"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FiBriefcase className="w-4 h-4" />
                <span>2. Company Details</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("location")}
                className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer ${
                  activeTab === "location"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <FiMapPin className="w-4 h-4" />
                <span>3. Location & Localization</span>
              </button>
            </div>

            {/* Form Container */}
            <form onSubmit={handleSubmit} className="bg-white rounded-b-2xl border border-t-0 border-slate-200/80 p-6 sm:p-8 space-y-6 shadow-xs">
              {/* TAB 1: GENERAL INFO */}
              {activeTab === "general" && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Organization Name */}
                  <div>
                    <label
                      htmlFor="org-name"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Organization Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiGlobe className="w-4 h-4" />
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
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Slug / Workspace URL */}
                  <div>
                    <label
                      htmlFor="org-slug"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Organization Slug (Workspace URL) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex rounded-xl shadow-2xs border border-slate-300 overflow-hidden focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent">
                      <span className="inline-flex items-center px-3.5 bg-slate-50 text-slate-500 text-xs font-mono border-r border-slate-200">
                        jira.web/org/
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
                        className="flex-1 h-11 px-3 bg-white text-slate-900 text-sm font-mono focus:outline-none"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Unique identifier used in URLs, reports, and API references.
                    </p>
                  </div>

                  {/* Logo URL */}
                  <div>
                    <label
                      htmlFor="logo_url"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Logo Image URL <span className="text-slate-400 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiImage className="w-4 h-4" />
                      </div>
                      <input
                        id="logo_url"
                        name="logo_url"
                        type="url"
                        value={formData.logo_url}
                        onChange={handleChange}
                        placeholder="https://example.com/logo.png"
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Direct URL to your company logo (PNG, JPG, or SVG).
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label
                      htmlFor="description"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Description <span className="text-slate-400 font-normal normal-case">(optional)</span>
                    </label>
                    <div className="relative">
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        value={formData.description}
                        onChange={handleChange}
                        placeholder="Brief summary of your company, mission, or projects..."
                        className="w-full p-3.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400 resize-none"
                      />
                    </div>
                  </div>

                  {/* Forward button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setActiveTab("company")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      <span>Continue to Company Details</span>
                      <FiArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANY DETAILS */}
              {activeTab === "company" && (
                <div className="space-y-5 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Industry */}
                    <div>
                      <label
                        htmlFor="industry"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Industry
                      </label>
                      <select
                        id="industry"
                        name="industry"
                        value={formData.industry}
                        onChange={handleChange}
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
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
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Company Size
                      </label>
                      <select
                        id="company_size"
                        name="company_size"
                        value={formData.company_size}
                        onChange={handleChange}
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
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
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Website URL
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiGlobe className="w-4 h-4" />
                      </div>
                      <input
                        id="website"
                        name="website"
                        type="url"
                        value={formData.website}
                        onChange={handleChange}
                        placeholder="https://acme.com"
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Work Email */}
                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Contact / Support Email
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiMail className="w-4 h-4" />
                        </div>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="contact@acme.com"
                          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Phone */}
                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Phone Number
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiPhone className="w-4 h-4" />
                        </div>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="+1 (555) 000-0000"
                          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setActiveTab("general")}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      ← Back to General
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("location")}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                      <span>Continue to Localization</span>
                      <FiArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: LOCATION & LOCALIZATION */}
              {activeTab === "location" && (
                <div className="space-y-5 animate-fadeIn">
                  {/* Address */}
                  <div>
                    <label
                      htmlFor="address"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                    >
                      Street Address
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiMapPin className="w-4 h-4" />
                      </div>
                      <input
                        id="address"
                        name="address"
                        type="text"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="100 Market St, Suite 400"
                        className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* City, State, Country, Postal Code */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label
                        htmlFor="city"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="state"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="country"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="postal_code"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
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
                        className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  {/* Timezone & Currency */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Timezone */}
                    <div>
                      <label
                        htmlFor="timezone"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Workspace Timezone
                      </label>
                      <div className="relative">
                        <select
                          id="timezone"
                          name="timezone"
                          value={formData.timezone}
                          onChange={handleChange}
                          className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        >
                          {TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz.value} value={tz.value}>
                              {tz.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Default timezone for sprint schedules, issue timestamps, and SLA metrics.
                      </p>
                    </div>

                    {/* Currency */}
                    <div>
                      <label
                        htmlFor="currency"
                        className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
                      >
                        Billing & Project Currency
                      </label>
                      <div className="relative">
                        <select
                          id="currency"
                          name="currency"
                          value={formData.currency}
                          onChange={handleChange}
                          className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                        >
                          {CURRENCY_OPTIONS.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Used for budget management, billing, and project rate cards.
                      </p>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveTab("company")}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                    >
                      ← Back to Company Details
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !formData.name.trim()}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-[#0052CC] hover:bg-[#0747A6] active:scale-[0.98] text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Creating Organization...</span>
                        </>
                      ) : (
                        <>
                          <span>Create Organization</span>
                          <FiArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Live Workspace Preview Card */}
          <div className="lg:col-span-1 space-y-5">
            <div className="sticky top-20 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              {/* Card Header Banner */}
              <div className="h-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 relative p-4 flex items-end">
                <span className="text-[10px] uppercase font-bold text-white/80 tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  Live Preview
                </span>
              </div>

              {/* Avatar & Org Info */}
              <div className="px-6 pb-6 pt-0 relative">
                <div className="-mt-10 mb-3 flex items-end justify-between">
                  <div className="w-18 h-18 rounded-2xl bg-white p-1 border border-slate-200 shadow-md">
                    {formData.logo_url ? (
                      <img
                        src={formData.logo_url}
                        alt="Logo"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                        className="w-full h-full object-cover rounded-xl"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-gradient-to-br from-[#0052CC] to-[#0747A6] flex items-center justify-center text-white text-2xl font-black">
                        {formData.name?.charAt(0)?.toUpperCase() || "O"}
                      </div>
                    )}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 border border-emerald-200">
                    Active
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 leading-tight">
                  {formData.name || "Acme Corporation"}
                </h3>
                <p className="text-xs font-mono text-blue-600 mt-0.5">
                  jira.web/org/{formData.slug || "acme-corp"}
                </p>

                {formData.description ? (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                    {formData.description}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 italic mt-2">
                    No description provided yet.
                  </p>
                )}

                {/* Metadata items */}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <FiBriefcase className="w-3.5 h-3.5" />
                      Industry
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formData.industry || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <FiUsers className="w-3.5 h-3.5" />
                      Team Size
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formData.company_size || "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <FiClock className="w-3.5 h-3.5" />
                      Timezone
                    </span>
                    <span className="font-semibold text-slate-800 font-mono text-[11px]">
                      {formData.timezone || "UTC"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-600">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <FiDollarSign className="w-3.5 h-3.5" />
                      Currency
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {formData.currency || "USD"}
                    </span>
                  </div>

                  {formData.city && (
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <FiMapPin className="w-3.5 h-3.5" />
                        Location
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formData.city}{formData.country ? `, ${formData.country}` : ""}
                      </span>
                    </div>
                  )}

                  {formData.website && (
                    <div className="flex items-center justify-between text-slate-600 pt-1">
                      <span className="flex items-center gap-1.5 text-slate-400">
                        <FiGlobe className="w-3.5 h-3.5" />
                        Website
                      </span>
                      <span className="font-semibold text-blue-600 truncate max-w-[150px]">
                        {formData.website.replace(/^https?:\/\//, "")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Creator badge */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Organization Creator</span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Owner Role
                  </span>
                </div>
              </div>
            </div>

            {/* Included Features */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Included in Your Workspace
              </h4>
              <ul className="text-xs text-slate-600 space-y-2">
                <li className="flex items-center gap-2">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Unlimited Kanban & Scrum sprint boards</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Role-based access (Owner, Manager, Member)</span>
                </li>
                <li className="flex items-center gap-2">
                  <FiCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Organization settings & member invitations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
