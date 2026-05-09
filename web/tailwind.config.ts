import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.25rem', md: '2rem' },
      screens: { '2xl': '1240px' },
    },
    extend: {
      colors: {
        // Canonical Happy Cake palette — docs/00-source/asset-pack.metadata.json
        sky: {
          DEFAULT: '#00AEEA',           // Happy Sky Blue — primary CTA / accent
          50: '#EAF7FE',
          100: '#D2EFFC',
          200: '#9DDCF7',
          300: '#5EC5F1',
          500: '#00AEEA',
          700: '#0388B3',
          900: '#054766',
        },
        cocoa: {
          DEFAULT: '#6B3A1E',           // Chocolate Brown — wordmark, body text
          50: '#F8EFE8',
          100: '#EDD9C8',
          200: '#D6B093',
          500: '#6B3A1E',
          700: '#4A2614',
          900: '#2A140A',
        },
        cream: {
          DEFAULT: '#FFF7EA',
          50: '#FFFBF3',
          100: '#FFF7EA',               // Vanilla Cream — primary background
          200: '#F8ECD3',
          300: '#EFDFB7',
        },
        berry: {
          DEFAULT: '#E94B7B',           // Berry Accent — promos, sparingly
          100: '#FBE0E9',
        },
        bakery: '#FFFFFF',              // Bakery White — cards, logo safe-space
        ink: '#2A140A',                 // Body text on cream (= cocoa-900)

        // shadcn semantic tokens — wired to Happy Cake palette so primitives
        // feel native instead of greyish defaults.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        display: ['var(--font-display)', '"Playfair Display"', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['clamp(2.5rem, 6vw, 4.25rem)', { lineHeight: '1.05', fontWeight: '600' }],
        h2: ['clamp(1.875rem, 3.6vw, 2.625rem)', { lineHeight: '1.15', fontWeight: '600' }],
        h3: ['1.5rem', { lineHeight: '1.25', fontWeight: '600' }],
      },
      boxShadow: {
        soft: '0 12px 40px -16px rgba(107, 58, 30, 0.18)',
        lift: '0 18px 50px -22px rgba(107, 58, 30, 0.28)',
        ring: '0 0 0 6px rgba(0, 174, 234, 0.18)',
      },
      backgroundImage: {
        'hero-glow':
          'radial-gradient(60% 60% at 78% 18%, rgba(0, 174, 234, 0.18) 0%, transparent 70%), linear-gradient(165deg, #FFFBF3 0%, #FFF7EA 50%, #FBE9F0 100%)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
