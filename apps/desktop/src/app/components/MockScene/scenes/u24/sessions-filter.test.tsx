// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_SESSIONS_FILTER_SCENES } from './sessions-filter';

const SETTLE_MS = 2_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const mount = async (name: string): Promise<Element> => {
  const Scene = U24_SESSIONS_FILTER_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`no scene ${name}`);
  }
  const { container } = render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
  expect(screen.queryByText('Something went wrong')).toBeNull();
  return container;
};

describe('the sessions filter scenes', () => {
  it('registers every scene for the capture', () => {
    const names = Object.keys(U24_SESSIONS_FILTER_SCENES).sort();
    expect(names).toEqual([
      'sessions-funnel',
      'sessions-funnel-open',
      'sessions-hidden',
      'sessions-nomatch',
    ]);
    for (const name of names) {
      expect(MOCK_SCENES[name]).toBe(U24_SESSIONS_FILTER_SCENES[name]);
    }
  });

  it('sessions-funnel names the trigger Filter sessions and marks an active filter with a dot', async () => {
    await mount('sessions-funnel');
    expect(screen.getByRole('button', { name: 'Filter sessions' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Options for sessions' })).toBeNull();
    expect(document.querySelector('[data-filter-dot="active"]')).not.toBeNull();
  });

  it('sessions-funnel-open lists the stages that have sessions and a Reset action', async () => {
    await mount('sessions-funnel-open');
    const dialog = screen.getByRole('dialog', { name: 'Filter sessions' });
    const status = within(dialog).getByRole('group', { name: 'Status' });
    expect(within(status).getAllByRole('checkbox').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDefined();
  });

  it('sessions-hidden says how many sessions the filters hide', async () => {
    await mount('sessions-hidden');
    expect(screen.getByText(/^\d+ hidden$/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDefined();
  });

  it('sessions-nomatch says no session matches and offers Clear', async () => {
    await mount('sessions-nomatch');
    expect(screen.getByText('No sessions match')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDefined();
  });

  it.each(Object.keys(U24_SESSIONS_FILTER_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
