/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        'ping-slow': {
          '0%':   { transform: 'scale(0.85)', opacity: '0.6' },
          '50%':  { transform: 'scale(1.05)', opacity: '0.25' },
          '100%': { transform: 'scale(0.85)', opacity: '0.6' },
        },
      },
      animation: {
        'ping-slow': 'ping-slow 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}