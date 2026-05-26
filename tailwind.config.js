/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        apple: {
          bg: '#F5F5F7',
          card: '#FFFFFF',
          text: '#1D1D1F',
          muted: '#86868B',
          accent: '#007AFF',
          border: 'rgba(0,0,0,0.08)'
        },
        'apple-dark': {
          bg: '#1C1C1E',
          card: '#2C2C2E',
          text: '#F5F5F7',
          muted: '#98989D',
          accent: '#0A84FF',
          border: 'rgba(255,255,255,0.1)'
        }
      },
      borderRadius: {
        apple: '12px',
        'apple-sm': '8px'
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI Variable', 'Segoe UI', 'sans-serif']
      },
      backdropBlur: {
        apple: '20px'
      }
    }
  },
  plugins: []
}
