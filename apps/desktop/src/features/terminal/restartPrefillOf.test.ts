// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { restartPrefillOf } from './restartPrefillOf';

describe('restartPrefillOf', () => {
  it('runs the last command again on a tab that exited by itself', () => {
    expect(restartPrefillOf({ tab: {}, command: 'pnpm test' })).toBe('pnpm test\r');
  });

  it('runs nothing when the tab never opened or nothing was typed', () => {
    expect(
      restartPrefillOf({ tab: { openError: 'spawn failed' }, command: 'pnpm test' }),
    ).toBeNull();
    expect(restartPrefillOf({ tab: {}, command: null })).toBeNull();
  });

  it('never replays the command that closed the shell', () => {
    expect(restartPrefillOf({ tab: {}, command: 'exit' })).toBeNull();
    expect(restartPrefillOf({ tab: {}, command: 'exit 1' })).toBeNull();
    expect(restartPrefillOf({ tab: {}, command: 'logout' })).toBeNull();
    expect(restartPrefillOf({ tab: {}, command: 'exiftool a.png' })).toBe('exiftool a.png\r');
  });
});
