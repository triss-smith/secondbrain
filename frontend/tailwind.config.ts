import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f1117',
          1: '#1a1d27',
          2: '#22263a',
          3: '#2a2f47',
        },
        accent: {
          DEFAULT: '#7c6af7',
          hover: '#9485f9',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
