export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light theme palette
        ink:    '#ffffff',       // page background (was dark)
        surface:'#f8fafc',       // component surface (was dark)
        panel:  '#ffffff',       // card/panel background
        panel2: '#f1f5f9',       // alternate panel
        edge:   '#e2e8f0',       // borders
        edge2:  '#cbd5e1',       // stronger borders
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
        'glow-pulse':     { '0%,100%': { boxShadow: '0 0 12px rgba(239,68,68,0.2)' }, '50%': { boxShadow: '0 0 28px rgba(239,68,68,0.4)' } },
        'radar-spin':     { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        'shimmer':        { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-sky':  '0 0 20px rgba(14,165,233,0.15)',
        'glow-red':  '0 0 20px rgba(239,68,68,0.15)',
        'glow-grn':  '0 0 20px rgba(22,163,74,0.15)',
        'glow-amb':  '0 0 20px rgba(245,158,11,0.15)',
        'panel':     '0 1px 8px rgba(0,0,0,0.08)',
        'panel-lg':  '0 4px 24px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
