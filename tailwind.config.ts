import { config as signalcoConfig } from '@signalco/ui-themes-minimal-app/config';
import type { Config } from 'tailwindcss';

const config = {
    darkMode: ['class'],
    content: [
        './components/**/*.{ts,tsx}',
        './app/**/*.{ts,tsx}',
        './src/**/*.{ts,tsx}',
        './features/**/*.{ts,tsx}',
        './providers/**/*.{ts,tsx}',
        './node_modules/@signalco/ui/**/*.{js,ts,jsx,tsx,mdx}',
        './node_modules/@signalco/ui-primitives/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    prefix: '',
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                '2xl': '1400px',
            },
        },
    },
    presets: [signalcoConfig],
    plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
