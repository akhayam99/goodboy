// @vitest-environment happy-dom

import { Inbox } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { PreviewHints } from './PreviewHints';
import type { PaletteEntry } from '../../types';

const { platform } = vi.hoisted(() => ({ platform: { current: 'darwin' as 'darwin' | 'linux' } }));

vi.mock('../../../../shared/platform', () => ({ currentPlatform: () => platform.current }));

afterEach(() => {
  cleanup();
  platform.current = 'darwin';
});

const entry: PaletteEntry = {
  key: 'session:payout',
  label: 'Payout export',
  kind: 'session',
  group: null,
  icon: Inbox,
  run: () => undefined,
};

const props = { entry, isActionsLevel: false, allLabel: 'Open all sessions', hasOtherModes: false };

describe('PreviewHints', () => {
  it('spells the keys with the mac glyphs', () => {
    const { container } = render(<PreviewHints {...props} />);
    expect(container.textContent).toBe('↵ Open · ⌘↵ Open all sessions');
  });

  it('spells the keys as words off the mac', () => {
    platform.current = 'linux';
    const { container } = render(<PreviewHints {...props} />);
    expect(container.textContent).toBe('Enter Open · Ctrl+Enter Open all sessions');
  });
});
