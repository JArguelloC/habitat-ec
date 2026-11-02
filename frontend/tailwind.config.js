/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-text': '#242523',
        'brand-bg': '#F9F8F5',
        'brand-primary': '#CBB279',
        'brand-secondary': '#6E7A6E',
        'brand-accent': '#8C733E',
        'brand-surface': '#FFFFFF',
        'brand-border': '#E7E4DC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(36, 37, 35, 0.06), 0 2px 6px -1px rgba(36, 37, 35, 0.04)',
        'elevated': '0 12px 32px -4px rgba(36, 37, 35, 0.1), 0 4px 12px -2px rgba(36, 37, 35, 0.06)',
      },
    },
  },
  plugins: [],
}
