type AnsiName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'brightBlack'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

type AnsiSteps = Readonly<Record<AnsiName, string>>;

const HUES = {
  red: '--red-11',
  green: '--green-11',
  yellow: '--amber-11',
  blue: '--blue-11',
  magenta: '--purple-11',
  cyan: '--cyan-11',
  brightRed: '--red-11',
  brightGreen: '--green-11',
  brightYellow: '--amber-11',
  brightBlue: '--blue-11',
  brightMagenta: '--purple-11',
  brightCyan: '--cyan-11',
} as const;

export const TERMINAL_ANSI_STEPS: Readonly<Record<'dark' | 'light', AnsiSteps>> = {
  dark: {
    ...HUES,
    black: '--gray-7',
    white: '--gray-11',
    brightBlack: '--gray-10',
    brightWhite: '--gray-12',
  },
  light: {
    ...HUES,
    black: '--gray-12',
    white: '--gray-10',
    brightBlack: '--gray-10',
    brightWhite: '--gray-9',
  },
};
