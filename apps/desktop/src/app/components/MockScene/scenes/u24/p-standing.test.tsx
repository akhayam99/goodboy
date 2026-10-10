// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_P_STANDING_SCENES } from './p-standing';

const SETTLE_MS = 2_000;
const STATES = ['confirmed', 'local', 'cannotcheck', 'breaker'] as const;

beforeAll(async () => {
  await importStore();
  await import('../../../../../features/settings/components/SettingsStudio');
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
  window.history.replaceState(null, '', '/');
});

const mount = async (state: string): Promise<Element> => {
  window.history.replaceState(null, '', `/?scene=providerhealth&state=${state}`);
  const Scene = U24_P_STANDING_SCENES['providerhealth'];
  if (Scene === undefined) {
    throw new Error('no scene providerhealth');
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

describe('the provider health scene', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U24_P_STANDING_SCENES)).toEqual(['providerhealth']);
    expect(MOCK_SCENES.providerhealth).toBe(U24_P_STANDING_SCENES.providerhealth);
  });

  it('confirmed shows the account and when the server last confirmed it', async () => {
    await mount('confirmed');

    expect(
      screen.getByText(/Signed in as mara\.quint@harborline\.dev\. Confirmed 2m ago/),
    ).toBeDefined();
    expect(screen.queryByText(/refused your last/)).toBeNull();
  });

  it('local says the sign-in is only on this Mac', async () => {
    await mount('local');

    expect(screen.getByText(/Signed in on this Mac\. Not confirmed by Cursor\./)).toBeDefined();
  });

  it('cannotcheck keeps the page and says what it last knew', async () => {
    await mount('cannotcheck');

    expect(screen.getByText("Can't reach Cursor right now")).toBeDefined();
    expect(screen.getByText('Showing what we last knew, from 2m ago.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDefined();
  });

  it('breaker says the last runs were refused and offers Sign in again', async () => {
    await mount('breaker');

    expect(screen.getByText('Cursor refused your last 3 runs')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Sign in again' }).length).toBeGreaterThan(0);
  });

  it.each(STATES)('%s has no accessibility violation once drawn', async (state) => {
    const container = await mount(state);
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
