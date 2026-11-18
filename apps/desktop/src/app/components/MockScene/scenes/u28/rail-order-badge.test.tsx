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
      'session-tools-order',
      'session-tools-quiet',
      'session-tools-signal',
    ]);
    for (const name of Object.keys(U28_RAIL_ORDER_BADGE_SCENES)) {
      expect(MOCK_SCENES[name]).toBe(U28_RAIL_ORDER_BADGE_SCENES[name]);
    }
  });

  it('session-tools-order reads the terminal, the browser, scripts, ask and monitoring, with no heading above them', () => {
    mount({ name: 'session-tools-order' });

    const toolbar = screen.getByRole('toolbar', { name: 'Tools' });
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Terminal', 'Browser', 'Scripts', 'Ask', 'Monitoring']);
    expect(toolbar.textContent).toBe('TerminalBrowserScriptsAskMonitor');
    expect(within(toolbar).queryByRole('separator')).toBeNull();
  });

  it('session-tools-quiet draws no number, the counts stay in the names', async () => {
    mount({ name: 'session-tools-quiet' });

    const toolbar = await screen.findByRole('toolbar', { name: 'Tools' });
    expect(toolbar.textContent).toBe('TerminalBrowserScriptsAskMonitor');
    expect(toolbar.querySelector('[data-signal]')).toBeNull();
    expect(
      within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'))
        .slice(0, 2),
    ).toEqual(['Terminal, 1 running', 'Browser, 12 tabs']);
    expect(screen.getByTestId('pane-toggle-browser').getAttribute('aria-pressed')).toBe('true');
  });

  it('session-tools-signal lights one dot on Terminal for a long command that ended', async () => {
    mount({ name: 'session-tools-signal' });

    const toolbar = await screen.findByRole('toolbar', { name: 'Tools' });
    const dots = Array.from(toolbar.querySelectorAll('[data-testid="tool-signal"]'));
    expect(dots.map((dot) => dot.getAttribute('data-signal'))).toEqual(['changed']);
    expect(dots[0]?.parentElement?.getAttribute('data-slot')).toBe('tool-glyph');
    expect(screen.getByTestId('pane-toggle-terminal').getAttribute('aria-label')).toBe(
      'Terminal, 1 running, pnpm test retry finished after 42s',
    );
    expect(toolbar.textContent).toBe('TerminalBrowserScriptsAskMonitor');
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
