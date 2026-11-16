// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U28_RAIL_ORDER_BADGE_SCENES } from './rail-order-badge';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ terminal_list_live: [] });
});

afterEach(cleanup);

type MountParams = {
  readonly name: string;
};

const mount = ({ name }: MountParams) => {
  const Scene = U28_RAIL_ORDER_BADGE_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  return render(<Scene />).container;
};

describe('rail order and badge scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U28_RAIL_ORDER_BADGE_SCENES).sort()).toEqual([
      'session-tools-counts',
      'session-tools-order',
      'sessions-door-counts',
    ]);
    for (const name of Object.keys(U28_RAIL_ORDER_BADGE_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(U28_RAIL_ORDER_BADGE_SCENES[name]);
    }
  });

  it('session-tools-order reads the terminal, then the browser, with no heading above them', () => {
    mount({ name: 'session-tools-order' });

    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Terminal', 'Browser']);
    expect(toolbar.textContent).toBe('TerminalBrowser');
    expect(within(toolbar).queryByRole('separator')).toBeNull();
  });

  it('session-tools-counts puts a neutral corner badge on each glyph, capped at 9+', async () => {
    mount({ name: 'session-tools-counts' });

    const toolbar = await screen.findByRole('toolbar', { name: 'Tools' });
    const badges = Array.from(toolbar.querySelectorAll('[data-testid="tool-count"]'));
    expect(badges.map((badge) => badge.textContent)).toEqual(['1', '9+']);
    expect(badges.map((badge) => badge.getAttribute('data-count-badge'))).toEqual([
      'neutral',
      'neutral',
    ]);
    expect(
      badges.every((badge) => badge.parentElement?.getAttribute('data-slot') === 'tool-glyph'),
    ).toBe(true);
    expect(screen.getByTestId('pane-toggle-browser').getAttribute('aria-pressed')).toBe('true');
  });

  it('sessions-door-counts draws a tone dot and a muted number, red only for a broken one', () => {
    mount({ name: 'sessions-door-counts' });

    const counts = Array.from(document.querySelectorAll('[data-door-count]'));
    expect(counts.map((count) => count.textContent)).toEqual(['1', '3', '9+']);
    expect(counts.map((count) => count.getAttribute('data-door-signal'))).toEqual([
      'warning',
      'warning',
      'danger',
    ]);
    expect(document.querySelector('[data-door-pill]')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Filter sessions' })).toHaveLength(3);
  });

  it.each(Object.keys(U28_RAIL_ORDER_BADGE_SCENES))(
    '%s has no accessibility violation',
    async (name) => {
      const container = mount({ name });

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
