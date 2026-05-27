/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}','./components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans','sans-serif'] },
      colors: {
        brand: { DEFAULT:'#2563EB', light:'#EFF4FF', mid:'#DBEAFE' },
      }
    },
  },
  plugins: [],
}
