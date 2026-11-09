// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';

const { platform } = vi.hoisted(() => {
  const platform: { current: 'darwin' | 'linux' | 'win32' } = { current: 'darwin' };
  return { platform };
});

vi.mock('../../platform', () => ({ currentPlatform: () => platform.current }));

import { isTerminalAppChord } from './isTerminalAppChord';

afterEach(() => {
  platform.current = 'darwin';
});

const keydown = (init: KeyboardEventInit): KeyboardEvent => new KeyboardEvent('keydown', init);

describe('isTerminalAppChord', () => {
  it('lets the close drawer chord out of the terminal on macOS', () => {
    expect(
      isTerminalAppChord({ event: keydown({ code: 'KeyW', metaKey: true, shiftKey: true }) }),
    ).toBe(true);
  });

  it('lets Ctrl+F4 out of the terminal off macOS', () => {
    platform.current = 'linux';

    expect(isTerminalAppChord({ event: keydown({ code: 'F4', ctrlKey: true }) })).toBe(true);
  });

  it('keeps the terminal tab chords out of the shell', () => {
    expect(isTerminalAppChord({ event: keydown({ code: 'Digit1', ctrlKey: true }) })).toBe(true);
  });

  it('leaves a plain key to the shell', () => {
    expect(isTerminalAppChord({ event: keydown({ code: 'KeyW', ctrlKey: true }) })).toBe(false);
  });
});
