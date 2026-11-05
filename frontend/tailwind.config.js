/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-text': withOpacity('--brand-text'),
        'brand-bg': withOpacity('--brand-bg'),
        'brand-primary': withOpacity('--brand-primary'),
        'brand-secondary': withOpacity('--brand-secondary'),
        'brand-accent': withOpacity('--brand-accent'),
        'brand-surface': withOpacity('--brand-surface'),
        'brand-border': withOpacity('--brand-border'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(0, 0, 0, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.05)',
        'elevated': '0 12px 32px -4px rgba(0, 0, 0, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
