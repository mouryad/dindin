/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dindin brand palette
        'deep-green': '#2D3A1F',
        'gold': '#B8A678',
        'pale-gold-light': '#F4F1E8',
        'pale-gold-medium': '#E8E2D0',
      },
      fontFamily: {
        fraunces: ['Fraunces_400Regular'],
        'fraunces-medium': ['Fraunces_500Medium'],
        'fraunces-bold': ['Fraunces_700Bold'],
        sora: ['Sora_400Regular'],
        'sora-medium': ['Sora_500Medium'],
        'sora-semibold': ['Sora_600SemiBold'],
      },
    },
  },
  plugins: [],
};
