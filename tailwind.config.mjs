/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,jsx,mdx}",
    "./src/components/**/*.{js,jsx,mdx}",
    "./src/app/**/*.{js,jsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          hover: "var(--primary-hover)",
          active: "var(--primary-active)",
          light: "var(--primary-light)",
          border: "var(--primary-border)",
          ring: "var(--primary-ring)",
        },
      },
      borderRadius: {
        DEFAULT: "var(--border-radius, 8px)",
        sm: "var(--border-radius, 8px)",
        md: "var(--border-radius, 8px)",
        lg: "var(--border-radius, 8px)",
        xl: "var(--border-radius, 8px)",
        "2xl": "var(--border-radius, 8px)",
        "3xl": "var(--border-radius, 8px)",
        full: "9999px",
      },
      screens: {
        xs: "480px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
        costom550: "550px",
        costom390: "390px",
        costom860: "860px",
        costom890: "890px",
        costom895: "895px",
        costom1150: "1150px",
        costom1080: "1080px",
        costom410: "410px",
        costom960: "960px",
        costom1660: "1660px",
      },
      fontFamily: {
        sans: ["var(--font-family-base)", "sans-serif"],
        poppins: ["var(--font-family-base)", "Poppins", "sans-serif"],
        montserrat: ["'Montserrat'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
