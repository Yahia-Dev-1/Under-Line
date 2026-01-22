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
          dark: '#1E1B4B', // indigo-950
          DEFAULT: '#3730A3', // indigo-800
          light: '#4F46E5', // indigo-600
        },
        background: {
          light: '#F1F5F9', // slate-100
          dark: '#020617', // slate-950
        },
        accent: {
          success: '#059669', // emerald-600
          warning: '#D97706', // amber-600
          error: '#DC2626', // red-600
        },
        slate: {
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
        }
      },
      backgroundImage: {
        'blue-gradient': 'linear-gradient(135deg, #312E81, #4F46E5, #818CF8)',
        'button-gradient': 'linear-gradient(90deg, #4F46E5, #6366F1)',
        'hover-gradient': 'linear-gradient(90deg, #6366F1, #4F46E5)',
        'glass': 'rgba(255, 255, 255, 0.7)',
      },
      boxShadow: {
        'modern': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025)',
        'modern-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
