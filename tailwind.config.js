/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
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

