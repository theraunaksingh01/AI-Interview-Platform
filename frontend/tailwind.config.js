/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{ts,tsx,js,jsx}",
    "./src/components/**/*.{ts,tsx,js,jsx}",
    "./app/**/*.{ts,tsx,js,jsx}",    // if you kept app/ at root
    "./components/**/*.{ts,tsx,js,jsx}"
  ],
  theme: {
    extend: {
      zIndex: {
        // add a small z-index utility z-2 -> z-index: 2
        2: "2",
      },
      spacing: {
        // custom spacing utilities:
        // w-560 => width: 35rem
        // h-1280 => height: 80rem
        // choose clear numeric keys to avoid odd class names
        560: "35rem",
        1280: "80rem",
      },
      // If you want to provide explicit height utilities (optional)
      height: {
        1280: "80rem",
      },
      width: {
        560: "35rem",
      },
    },
  },
  plugins: [
    // add plugins here if you use them later (e.g., line-clamp)
  ],
};
