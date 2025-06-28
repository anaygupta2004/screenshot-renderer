// Tailwind CSS v4 uses CSS instead of JS config
// This file may not be needed for v4
import { type Config } from 'tailwindcss'

export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
} satisfies Config