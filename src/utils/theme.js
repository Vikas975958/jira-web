/**
 * Centralized theme configuration for the WorkGrid Web Application.
 *
 * Selected Primary Color: #0F766E (Teal 700)
 * Global Primary Button Theme & State Tokens
 */

export const PRIMARY_COLOR = "#0F766E";
export const PRIMARY_HOVER = "#0D655E";
export const PRIMARY_ACTIVE = "#115E59";
export const PRIMARY_FOCUS_RING = "rgba(15, 118, 110, 0.25)";
export const PRIMARY_LIGHT = "#F0FDFA";
export const PRIMARY_BORDER = "#99F6E4";
export const PRIMARY_SHADOW = "rgba(15, 118, 110, 0.2)";
export const BORDER_RADIUS = "8px";

export const themeColors = {
  primary: PRIMARY_COLOR,
  primaryHover: PRIMARY_HOVER,
  primaryActive: PRIMARY_ACTIVE,
  primaryFocusRing: PRIMARY_FOCUS_RING,
  primaryLight: PRIMARY_LIGHT,
  primaryBorder: PRIMARY_BORDER,
  primaryShadow: PRIMARY_SHADOW,
  borderRadius: BORDER_RADIUS,
};

/**
 * Standard Tailwind class string for primary action buttons.
 * Guarantees visual consistency across desktop, tablet, and mobile with 8px radius.
 */
export const primaryButtonClasses =
  "inline-flex items-center justify-center gap-2 bg-[#0F766E] hover:bg-[#0D655E] active:bg-[#115E59] active:scale-[0.98] text-white font-bold rounded-lg shadow-md shadow-teal-900/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer";

const primary = PRIMARY_COLOR;
export default primary;