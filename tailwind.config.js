/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e1e9fe',
          200: '#c7d5fd',
          300: '#9fb5fb',
          400: '#6d8bf7',
          500: '#4762f0',
          600: '#1c398e', // Brand Blue (Main)
          700: '#162d70', // Brand Blue (Dark)
          800: '#102152', // Brand Blue (Darker)
          900: '#0b1638',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
    },
  },
  plugins: [],
}
