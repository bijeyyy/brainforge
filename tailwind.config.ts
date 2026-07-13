import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4F46E5', 50: '#EEF2FF', 100: '#E0E7FF', 600: '#4F46E5', 700: '#4338CA' },
        accent: { DEFAULT: '#7C3AED', 50: '#F5F3FF', 100: '#EDE9FE', 600: '#7C3AED' },
      },
      fontFamily: {
        display: ['Poppins', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04)',
        lift: '0 4px 12px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
}
export default config
