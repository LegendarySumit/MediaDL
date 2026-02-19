/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      screens: {
        'xs': '320px',  // Extra small devices (320px and up)
        // Default Tailwind breakpoints:
        // 'sm': '640px',
        // 'md': '768px',
        // 'lg': '1024px',
        // 'xl': '1280px',
        // '2xl': '1536px',
      },
      spacing: {
        '17.5': '4.375rem', // 70px - custom navbar height
      },
      height: {
        '17.5': '4.375rem', // 70px
      },
      paddingTop: {
        '17.5': '4.375rem', // 70px
      },
    },
  },
  plugins: [],
};
