import type { WireframeSpacing, WireframeTheme, WireframeViewport } from '@goodboy/core';
import type { WireframeFidelity } from './wireframeFidelity';

export type WireframePalette = Readonly<{
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  accent: string;
  accentForeground: string;
  danger: string;
  radius: number;
  fontFamily: string;
}>;

const NEUTRAL: WireframePalette = {
  background: '#f4f4f5',
  surface: '#ffffff',
  foreground: '#3f3f46',
  muted: '#a1a1aa',
  border: '#d4d4d8',
  accent: '#d4d4d8',
  accentForeground: '#3f3f46',
  danger: '#a1a1aa',
  radius: 6,
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',
};

const RADIUS: Record<string, number> = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 14,
  full: 999,
};

const FONT: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, serif',
  mono: 'ui-monospace, SFMono-Regular, monospace',
};

export const SPACING_PX: Record<WireframeSpacing, number> = {
  none: 0,
  sm: 6,
  md: 12,
  lg: 20,
};

export const VIEWPORT_WIDTH: Record<WireframeViewport, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
};

export const VIEWPORT_MIN_HEIGHT: Record<WireframeViewport, number> = {
  mobile: 640,
  tablet: 720,
  desktop: 720,
};

export const CONTACT_SHEET_PLATE_WIDTH: Record<WireframeViewport, number> = {
  mobile: 230,
  tablet: 370,
  desktop: 520,
};

export const wireframePalette = ({
  theme,
  fidelity,
}: {
  readonly theme: WireframeTheme;
  readonly fidelity: WireframeFidelity;
}): WireframePalette => {
  if (fidelity === 'low') {
    return NEUTRAL;
  }
  const colors = theme.colors ?? {};
  return {
    background: colors.background ?? NEUTRAL.background,
    surface: colors.surface ?? NEUTRAL.surface,
    foreground: colors.foreground ?? NEUTRAL.foreground,
    muted: colors.muted ?? NEUTRAL.muted,
    border: colors.border ?? NEUTRAL.border,
    accent: colors.accent ?? NEUTRAL.accent,
    accentForeground: colors.accentForeground ?? NEUTRAL.accentForeground,
    danger: colors.danger ?? NEUTRAL.danger,
    radius: RADIUS[theme.radius ?? 'md'] ?? NEUTRAL.radius,
    fontFamily: FONT[theme.font ?? 'sans'] ?? NEUTRAL.fontFamily,
  };
};
