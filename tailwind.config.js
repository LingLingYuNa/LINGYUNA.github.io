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
        'none': '0px',
        'sm': '0px',
        DEFAULT: '0px',
        'md': '0px',
        'lg': '0px',
        'xl': '0px',
        '2xl': '0px',
        '3xl': '0px',
        'full': '0px',
        '2r': '0px',
        '2R': '0px',
        '3.5r': '0px',
        '3.5R': '0px',
      },
      colors: {
        neo: {
          coral: '#FF6B6B',
          mint: '#4ECDC4',
          yellow: '#FFE66D',
          teal: '#95E1D3',
          peach: '#F38181',
          black: '#000000',
          white: '#FFFFFF',
        },
        primary: {
          light: '#FFE66D',
          DEFAULT: '#FF6B6B',
          dark: '#E05252'
        },
        secondary: {
          light: '#95E1D3',
          DEFAULT: '#4ECDC4',
          dark: '#3BB0A7'
        }
      },
      boxShadow: {
        'neo-sm': '3px 3px 0px 0px rgba(0,0,0,1)',
        'neo': '5px 5px 0px 0px rgba(0,0,0,1)',
        'neo-lg': '8px 8px 0px 0px rgba(0,0,0,1)',
        'neo-coral': '5px 5px 0px 0px rgba(255,107,107,1)',
        'neo-mint': '5px 5px 0px 0px rgba(78,205,196,1)',
        'neo-yellow': '5px 5px 0px 0px rgba(255,230,109,1)',
      }
    },
  },
  plugins: [],
}
