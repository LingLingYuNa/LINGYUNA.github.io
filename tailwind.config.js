/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        'sm': '14px',
        DEFAULT: '14px',
        'md': '14px',
        'lg': '14px',
        'xl': '14px',
        '2xl': '14px',
        '3xl': '14px',
        '3.5r': '14px',
        '3.5R': '14px',
      },
      colors: {
        primary: {
          light: '#F4EDFD',
          DEFAULT: '#B890DF',
          dark: '#9363C4'
        },
        secondary: {
          light: '#EDF7EB',
          DEFAULT: '#A5D59A',
          dark: '#71A864'
        }
      }
    },
  },
  plugins: [],
}

