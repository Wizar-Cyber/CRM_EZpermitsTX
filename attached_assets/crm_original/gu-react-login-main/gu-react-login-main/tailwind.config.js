/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        leadGreen: "#bbf7d0",   // verde pastel
        leadYellow: "#fde68a",  // amarillo pastel
        leadRed: "#fecaca",     // rojo pastel
      },
    },
  },
  plugins: [],
}
