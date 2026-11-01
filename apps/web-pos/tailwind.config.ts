import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#18668F',
          'primary-hover': '#135273',
          'primary-light': '#E8F2F8',
          secondary: '#80BF1F',
          'secondary-hover': '#6ea41a',
          'secondary-light': '#F2F9E8',
          accent: '#F5A51D',
          'accent-hover': '#d98d12',
          surface: '#FFFFFF',
          bg: '#F8F9FA',
          dark: '#0F172A',
          border: '#E2E8F0',
        },
      },
    },
  },
  plugins: [],
};

export default config;

