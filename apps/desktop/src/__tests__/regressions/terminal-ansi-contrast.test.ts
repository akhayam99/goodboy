// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { TERMINAL_ANSI_STEPS } from '../../shared/components/GenericTerminalPanel/terminalAnsiSteps';
import {
  contrastRatio,
  scaleStepOf,
  THEME_NAMES,
  tokenOf,
  type Theme,
} from '../../test/styleTokens';

const MIN_TEXT_CONTRAST = 4.5;
const MIN_BRIGHT_WHITE_ON_PAPER = 3;
const MIN_BLACK_ON_SHEET = 3;
const STEP = /^--([a-z]+)-(\d+)$/;

type FloorParams = { readonly theme: Theme; readonly name: string };

const floorOf = ({ theme, name }: FloorParams): number => {
  if (theme === 'dark' && name === 'black') {
    return MIN_BLACK_ON_SHEET;
  }
  if (theme === 'light' && name === 'brightWhite') {
    return MIN_BRIGHT_WHITE_ON_PAPER;
  }
  return MIN_TEXT_CONTRAST;
};

describe.each(THEME_NAMES)('terminal ANSI contrast in %s', (theme) => {
  it.each(Object.entries(TERMINAL_ANSI_STEPS[theme]))(
    '%s reads on the terminal sheet',
    (name, token) => {
      const step = token.match(STEP);
      if (step === null) {
        throw new Error(`${name} names no scale step: ${token}`);
      }
      const color = scaleStepOf({ theme, scale: String(step[1]), step: Number(step[2]) });
      const ratio = contrastRatio({
        first: color,
        second: tokenOf({ theme, name: 'background' }).rgb,
      });
      expect(ratio).toBeGreaterThanOrEqual(floorOf({ theme, name }));
    },
  );
});
