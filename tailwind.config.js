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
        'sm': '8px',
        DEFAULT: '8px',
        'md': '8px',
        'lg': '8px',
        'xl': '8px',
        '2xl': '8px',
        '3xl': '8px',
        '2r': '8px',
        '2R': '8px',
        '3.5r': '8px',
        '3.5R': '8px',
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

