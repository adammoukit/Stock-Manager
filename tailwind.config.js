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
          50: '#e6edf2',
          100: '#c5d5e2',
          200: '#92b3cc',
          300: '#5f91b6',
          400: '#2c6fa0',
          500: '#004a7a',
          600: '#001d35', // Brand Blue (Main)
          700: '#00172b', // Brand Blue (Dark)
          800: '#00101e', // Brand Blue (Darker)
          900: '#00080f',
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
