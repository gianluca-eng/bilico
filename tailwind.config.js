/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2D6BE4',
        'primary-dark': '#1D55C5',
        'primary-light': '#EBF1FD',
      },
      fontFamily: {
        heading: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['Epilogue', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
