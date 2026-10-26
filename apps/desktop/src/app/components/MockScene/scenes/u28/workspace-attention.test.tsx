// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { MOCK_SCENES } from '../..';
import { U28_WORKSPACE_ATTENTION_SCENES } from './workspace-attention';

const SETTLE_MS = 2_000;
const SCENE = 'u28-workspace-attention';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 0 } });
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  applyDocumentTheme({ theme: 'dark' });
});

const mount = async (): Promise<Element> => {
  const Scene = U28_WORKSPACE_ATTENTION_SCENES[SCENE];
  if (Scene === undefined) {
    throw new Error('no scene');
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

describe('the workspace attention scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U28_WORKSPACE_ATTENTION_SCENES[SCENE]);
  });

  it('says in the picker which workspaces need you and why', async () => {
    await mount();

    const dialog = screen.getByRole('dialog', { name: 'Switch or open a workspace' });
    const northwind = within(dialog).getByRole('button', {
      name: 'Switch to Northwind, 2 need you',
    });
    expect(northwind.textContent).toContain('Checks failing, 1 question for you');
    expect(
      within(dialog)
        .getByRole('button', { name: 'Switch to Acme, 1 needs you' })
        .querySelector('[data-workspace-attention]')
        ?.getAttribute('data-workspace-attention'),
    ).toBe('warning');
  });

  it('puts the sum of the other workspaces on the workspace name', async () => {
    const container = await mount();

    const trigger = container.querySelector('button[aria-label^="Switch workspace"]');
    expect(trigger?.getAttribute('aria-label')).toBe(
      'Switch workspace: Harborline, 3 need you in other workspaces',
    );
    expect(trigger?.querySelector('[data-workspace-attention="danger"]')?.textContent).toBe('3');
  });

  it('has no accessibility violation', async () => {
    const container = await mount();
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
