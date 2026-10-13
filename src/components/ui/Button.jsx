"use client";

import React from "react";

/**
 * Standardized WorkGrid Button Component
 *
 * Adheres to global theme primary color (#0F766E).
 *
 * Variants:
 * - primary: Global primary color (#0F766E), teal hover/active/ring states
 * - secondary: Slate neutral for secondary actions (Cancel, Back, etc.)
 * - outline: Bordered subtle style
 * - danger: Destructive actions (Delete, Logout, etc.)
 * - ghost: Borderless icon/inline actions
 *
 * Sizes:
 * - sm: Compact (px-3 py-1.5 text-xs)
 * - md: Standard (px-5 py-2 text-xs sm:text-sm)
 * - lg: Prominent (px-6 py-3 text-sm)
 */
export default function Button({
  children,
  variant = "primary",
  size = "md",
  type = "button",
  disabled = false,
  isLoading = false,
  icon = null,
  rightIcon = null,
  className = "",
  onClick,
  ...props
}) {
  const baseClasses =
    "inline-flex items-center justify-center font-bold transition-all select-none cursor-pointer disabled:cursor-not-allowed";

  const sizeClasses = {
    sm: "px-3.5 py-1.5 text-xs rounded-lg gap-1.5",
    md: "px-5 py-2 text-xs rounded-lg gap-2",
    lg: "px-6 py-3 text-sm rounded-lg gap-2.5",
  };

  const variantClasses = {
    primary:
      "bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white shadow-md shadow-teal-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] focus-visible:ring-offset-2 disabled:opacity-50 disabled:shadow-none",
    secondary:
      "bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50",
    outline:
      "border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50",
    danger:
      "bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.98] text-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50",
    destructive:
      "bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-[0.98] text-white shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50",
    ghost:
      "text-slate-600 hover:bg-slate-100 active:bg-slate-200 rounded-lg disabled:opacity-50",
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseClasses} ${sizeClasses[size] || sizeClasses.md} ${
        variantClasses[variant] || variantClasses.primary
      } ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
