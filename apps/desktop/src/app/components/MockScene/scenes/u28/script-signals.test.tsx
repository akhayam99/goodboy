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
import { act, cleanup, render, screen } from '@testing-library/react';
import { MOCK_SCENES } from '../..';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { U28_SCRIPT_SIGNALS_SCENES } from './script-signals';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ terminal_list_live: [] });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('script signals scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U28_SCRIPT_SIGNALS_SCENES)).toEqual(['script-signals']);
    expect(MOCK_SCENES['script-signals']).toBe(U28_SCRIPT_SIGNALS_SCENES['script-signals']);
  });

  it('shows the failed script and the finished command on the tools column', () => {
    const Scene = U28_SCRIPT_SIGNALS_SCENES['script-signals'];
    render(<Scene />);

    expect(screen.getByTestId('pane-toggle-scripts').getAttribute('aria-label')).toBe(
      'Scripts, Check posting drift failed. Open its output.',
    );
    expect(screen.getByTestId('pane-toggle-terminal').getAttribute('aria-label')).toBe(
      'Terminal, pnpm test finished after 42s',
    );
  });

  it('raises one toast with Open output once the session is off screen', () => {
    const Scene = U28_SCRIPT_SIGNALS_SCENES['script-signals'];
    render(<Scene />);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getAllByText('Check posting drift failed in ledger-core')).toHaveLength(1);
    screen.getByRole('button', { name: 'Open output' });
  });
});
