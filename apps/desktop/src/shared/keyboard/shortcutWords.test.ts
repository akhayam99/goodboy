// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

type Platform = 'darwin' | 'linux';

type PlatformBox = {
  readonly platform: { current: Platform };
};

const { platform } = vi.hoisted((): PlatformBox => ({ platform: { current: 'darwin' } }));

vi.mock('../platform', () => ({ currentPlatform: () => platform.current }));

import { shortcutWords } from './shortcutWords';

afterEach(() => {
  platform.current = 'darwin';
});

describe('shortcutWords', () => {
  it('names the macOS modifiers in words on darwin', () => {
    expect(shortcutWords({ id: 'session.delete' })).toBe('Command Shift Backspace');
    expect(shortcutWords({ id: 'session.spawned' })).toBe('Command Option A');
  });

  it('names the keys a person presses off darwin', () => {
    platform.current = 'linux';

    expect(shortcutWords({ id: 'palette.open' })).toBe('Ctrl K');
    expect(shortcutWords({ id: 'session.delete' })).toBe('Ctrl Shift Backspace');
  });
});
