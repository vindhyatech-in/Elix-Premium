/**
 * Elix Mobile App Design System Tokens
 * 1:1 Parity with static/css/variables.css & main.css
 * Palette: Modern Aesthetic Minimalist (Black, White, Blue, Green)
 */

export const ElixColors = {
  // --- Core Palette ---
  ink: '#0F172A',            // Deep Slate Black (Headings & Primary Text)
  inkSoft: '#1E293B',        // Dark Charcoal (Secondary Dark Surface)
  inkMuted: '#64748B',       // Muted Slate Text (Captions & Subtitles)
  cream: '#FFFFFF',          // Pure White
  creamDeep: '#F8FAFC',      // Soft Light Surface (Page Background)
  white: '#FFFFFF',          // Pure White

  // --- Vibrant Brand Accents ---
  blue: '#4F46E5',           // Indigo Royal Blue (Primary CTA, Active Tabs, Highlights)
  blueLight: '#EEF2FF',      // Soft Indigo Tint (Selected Chips & Icon Badges)
  blueDeep: '#3730A3',       // Deep Indigo (Pressed State)
  
  green: '#059669',          // Emerald Green (Discounts, Success & Savings Highlights)
  greenLight: '#ECFDF5',     // Soft Emerald Tint (Free Delivery & Savings Badges)
  greenDeep: '#047857',      // Deep Emerald (Pressed State)

  // --- Express Urgency Accent (Mapped to Blue/Indigo same as web) ---
  urgentRed: '#4F46E5',      // Royal Blue (Matches Web --accent-gold: #4f46e5)
  urgentRedLight: '#EEF2FF', // Soft Indigo Tint
  urgentBorder: '#C7D2FE',   // Indigo Border Hairline

  // --- Surface / Neutral Tiers ---
  surface1: '#F8FAFC',       // Screen Background
  surface2: '#FFFFFF',       // Card & Sheet Background
  surface3: '#F1F5F9',       // Segmented Controls & Tag Background
  surfaceGlass: 'rgba(255, 255, 255, 0.85)',
  surfaceGlassDark: 'rgba(15, 23, 42, 0.85)',

  // --- Hairlines & Dividers ---
  borderHairline: 'rgba(15, 23, 42, 0.08)',
  borderHairlineMedium: 'rgba(15, 23, 42, 0.14)',
  borderHairlineDark: 'rgba(255, 255, 255, 0.12)',

  // --- Legacy Gold & Ratings mapped to Blue same as web ---
  starGold: '#4F46E5',       // Same as web --gold-deep: var(--blue)
  gold: '#4F46E5',           // Same as web --gold: var(--blue)
  goldLight: '#EEF2FF',      // Same as web --gold-light: var(--blue-light)
};

export const ElixTypography = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    display: 28,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
    extraBold: '800' as const,
  },
};

export const ElixRadii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
  full: 9999,
};

export const ElixShadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
