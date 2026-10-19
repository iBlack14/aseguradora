/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#486800",
        "primary-container": "#8bc500",
        "on-primary": "#ffffff",
        "on-primary-container": "#344d00",
        "secondary": "#406900",
        "secondary-container": "#baf473",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4fc",
        "surface-container": "#e9eef6",
        "surface-container-high": "#e3e9f0",
        "surface-container-highest": "#dde3eb",
        "on-surface": "#161c22",
        "on-surface-variant": "#434935",
        "surface-variant": "#dde3eb",
        "error": "#ba1a1a",
        "error-container": "#ffdad6"
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"]
      }
    },
  },
  plugins: [],
};
