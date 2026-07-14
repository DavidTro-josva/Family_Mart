/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          green: {
            50: '#eefdf5',
            100: '#d7fbe5',
            200: '#b2f5cd',
            300: '#7aecaa',
            400: '#3cdb7f',
            500: '#12be5d', // Family Mart Green
            600: '#099d4a',
            700: '#0b7b3d',
            800: '#0e6133',
            900: '#0d502c',
            950: '#052d18',
          },
          blue: {
            50: '#eff8ff',
            100: '#dbf0ff',
            200: '#bee3ff',
            300: '#91d2ff',
            400: '#5cb9ff',
            500: '#0070c0', // Family Mart Blue
            600: '#0077e6',
            700: '#005ebd',
            800: '#004f99',
            900: '#004280',
            950: '#00254d',
          }
        },
        dark: {
          bg: '#0f172a',     // slate-900
          card: '#1e293b',   // slate-800
          border: '#334155', // slate-700
          text: '#f8fafc',   // slate-50
          muted: '#94a3b8',  // slate-400
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 112, 192, 0.08), 0 2px 12px -2px rgba(18, 190, 93, 0.06)',
        'premium-hover': '0 10px 25px -3px rgba(0, 112, 192, 0.12), 0 4px 18px -3px rgba(18, 190, 93, 0.08)',
      }
    },
  },
  plugins: [],
}
