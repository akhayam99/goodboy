import type { ITheme } from '@xterm/xterm';
import { TERMINAL_ANSI_STEPS } from './terminalAnsiSteps';

type TerminalTheme = 'dark' | 'light';

type TokenMap = Readonly<Partial<Record<Exclude<keyof ITheme, 'extendedAnsi'>, string>>>;

const SURFACE_TOKENS: TokenMap = {
  background: '--color-background',
  foreground: '--color-foreground',
  cursor: '--color-primary',
  selectionBackground: '--color-selection',
  scrollbarSliderBackground: '--color-scrollbar-thumb',
  scrollbarSliderHoverBackground: '--color-scrollbar-thumb-active',
  scrollbarSliderActiveBackground: '--color-scrollbar-thumb-active',
};

const rootStyles = (): CSSStyleDeclaration | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  return window.getComputedStyle(document.documentElement);
};

type ReadTokenParams = { readonly styles: CSSStyleDeclaration; readonly token: string };

const readToken = ({ styles, token }: ReadTokenParams): string | null => {
  const value = styles.getPropertyValue(token).trim();
  return value.length > 0 ? value : null;
};

type ThemeParams = { readonly theme: TerminalTheme };

export const resolveTerminalTheme = ({ theme }: ThemeParams): ITheme => {
  const styles = rootStyles();
  if (styles === null) {
    return {};
  }
  const tokens: TokenMap = { ...TERMINAL_ANSI_STEPS[theme], ...SURFACE_TOKENS };
  return Object.fromEntries(
    Object.entries(tokens).flatMap(([key, token]) => {
      const value = token === undefined ? null : readToken({ styles, token });
      return value === null ? [] : [[key, value]];
    }),
  );
};

export type TerminalFindColors = {
  readonly matchBackground: string;
  readonly matchOverviewRuler: string;
  readonly activeMatchBackground: string;
  readonly activeMatchColorOverviewRuler: string;
};

const FIND_STEPS: Readonly<Record<TerminalTheme, TerminalFindColors>> = {
  dark: {
    matchBackground: '--amber-6',
    matchOverviewRuler: '--amber-9',
    activeMatchBackground: '--amber-8',
    activeMatchColorOverviewRuler: '--amber-11',
  },
  light: {
    matchBackground: '--amber-5',
    matchOverviewRuler: '--amber-9',
    activeMatchBackground: '--amber-7',
    activeMatchColorOverviewRuler: '--amber-11',
  },
};

export const resolveTerminalFindColors = ({
  theme,
}: ThemeParams): TerminalFindColors | undefined => {
  const styles = rootStyles();
  if (styles === null) {
    return undefined;
  }
  const steps = FIND_STEPS[theme];
  const matchBackground = readToken({ styles, token: steps.matchBackground });
  const matchOverviewRuler = readToken({ styles, token: steps.matchOverviewRuler });
  const activeMatchBackground = readToken({ styles, token: steps.activeMatchBackground });
  const activeMatchColorOverviewRuler = readToken({
    styles,
    token: steps.activeMatchColorOverviewRuler,
  });
  if (
    matchBackground === null ||
    matchOverviewRuler === null ||
    activeMatchBackground === null ||
    activeMatchColorOverviewRuler === null
  ) {
    return undefined;
  }
  return {
    matchBackground,
    matchOverviewRuler,
    activeMatchBackground,
    activeMatchColorOverviewRuler,
  };
};
