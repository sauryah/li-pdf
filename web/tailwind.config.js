/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f0',
          100: '#ffe1df',
          200: '#ffc7c4',
          500: '#e5322d',
          600: '#d42227',
          700: '#b8191e',
          800: '#98181c',
          900: '#7e1b1e',
        },
        surface: {
          bg: '#f4f5f8',
          card: '#ffffff',
          border: '#e5e7eb',
        },
      },
      boxShadow: {
        'tool-card': '0 2px 8px rgba(0, 0, 0, 0.04)',
        'tool-card-hover': '0 12px 28px rgba(0, 0, 0, 0.08)',
        'cta-red': '0 8px 24px rgba(229, 50, 45, 0.28)',
      },
    },
  },
  plugins: [],
}
