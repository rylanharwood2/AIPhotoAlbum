export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cormorant Garamond"', 'serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      colors: {
        film: {
          bg: '#0e0d0b', surface: '#1a1814', border: '#2e2b24',
          amber: '#c9913a', gold: '#e8b86d', cream: '#f0e6d3', muted: '#7a7060',
        },
      },
    },
  },
  plugins: [],
}
