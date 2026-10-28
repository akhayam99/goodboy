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

const mount = (name: string) => {
  const Scene = U28_RAIL_ORDER_BADGE_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  return render(<Scene />).container;
};

describe('rail order and badge scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U28_RAIL_ORDER_BADGE_SCENES).sort()).toEqual([
      'session-tools-order',
      'sessions-door-counts',
    ]);
    for (const name of Object.keys(U28_RAIL_ORDER_BADGE_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(U28_RAIL_ORDER_BADGE_SCENES[name]);
    }
  });

  it('session-tools-order reads files and context, then talk and work, then the terminal', () => {
    mount('session-tools-order');

    const toolbar = screen.getByRole('toolbar', { name: 'Session tools' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Explore', 'Context', 'Ask', 'Agents', 'Scripts', 'Terminal']);
    expect(within(toolbar).getAllByRole('separator')).toHaveLength(2);
  });

  it('sessions-door-counts draws a tone dot and a muted number, red only for a broken one', () => {
    mount('sessions-door-counts');

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
      const container = mount(name);

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
