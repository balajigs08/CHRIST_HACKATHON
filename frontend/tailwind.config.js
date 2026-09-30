export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink:    '#060d1a',
        surface:'#0b1525',
        panel:  '#0f1d30',
        panel2: '#132236',
        edge:   '#1c2e47',
        edge2:  '#253a56',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      animation: {
        'flash':        'flash 1.1s ease-in-out infinite',
        'flash-slow':   'flash 2s ease-in-out infinite',
        'slide-in':     'slide-in-right 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
        'slide-up':     'slide-in-up 0.3s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-ring':   'pulse-ring 1.5s ease-out infinite',
        'glow-pulse':   'glow-pulse 2s ease-in-out infinite',
        'radar-spin':   'radar-spin 3s linear infinite',
        'shimmer':      'shimmer 1.5s infinite',
      },
      keyframes: {
        flash:            { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
        'slide-in-right': { from: { transform: 'translateX(120%)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        'slide-in-up':    { from: { transform: 'translateY(20px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        'pulse-ring':     { '0%': { transform: 'scale(0.8)', opacity: 0.8 }, '100%': { transform: 'scale(2.2)', opacity: 0 } },
        'glow-pulse':     { '0%,100%': { boxShadow: '0 0 12px rgba(239,68,68,0.3)' }, '50%': { boxShadow: '0 0 28px rgba(239,68,68,0.6)' } },
        'radar-spin':     { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'shimmer':        { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-sky':  '0 0 20px rgba(56,189,248,0.25)',
        'glow-red':  '0 0 20px rgba(239,68,68,0.25)',
        'glow-grn':  '0 0 20px rgba(34,197,94,0.25)',
        'glow-amb':  '0 0 20px rgba(251,191,36,0.25)',
        'panel':     '0 4px 24px rgba(0,0,0,0.4)',
        'panel-lg':  '0 8px 48px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
}
