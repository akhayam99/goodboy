// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U24_P_NAV_SCENES } from './p-nav';

beforeAll(async () => {
  await Promise.all([
    import('../../../../../features/session/components/SessionWorkspace/parts/IntegrationPane'),
    import('../../../../../features/session/components/SessionWorkspace/parts/IntegrationPane/GithubTaskDetail'),
  ]);
});

const mainPane = (): HTMLElement => {
  const main = document.querySelector<HTMLElement>('[data-drawer-main]');
  if (main === null) {
    throw new Error('no main pane');
  }
  return main;
};

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
  const Scene = U24_P_NAV_SCENES[name];
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

describe('the navigation scenes', () => {
  it('registers the scene for the capture', () => {
    expect(Object.keys(U24_P_NAV_SCENES)).toEqual(['integration-issue-focused']);
    expect(MOCK_SCENES['integration-issue-focused']).toBe(
      U24_P_NAV_SCENES['integration-issue-focused'],
    );
  });

  it('integration-issue-focused draws a back row, keeps Unlink in the menu, and no link action', async () => {
    await mount('integration-issue-focused');

    expect(screen.queryByRole('button', { name: 'All issues' })).toBeNull();
    expect(
      [...document.querySelectorAll('[data-session-back]')].filter(
        (back) => back.closest('[data-session-head]') === null,
      ),
    ).toEqual([]);
    expect(document.querySelector('[data-slot="trail"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unlink NW-142' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More actions for NW-142' })).toBeDefined();
    const pageLinks = within(mainPane())
      .queryAllByRole('button', { name: /^Link/ })
      .filter((button) => button.closest('[data-session-rail]') === null);
    expect(pageLinks).toEqual([]);
  });

  it.each(Object.keys(U24_P_NAV_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
