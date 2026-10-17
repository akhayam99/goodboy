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
import { applyDocumentTheme } from '../../../../../shared/lib/theme';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { runA11yCheck } from '../../../../../__tests__/a11y/utils';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_R4_WORKSPACE_SCENES } from './r4-workspace';

const SETTLE_MS = 2_000;

const NAMES = [
  'r4-column-dark',
  'r4-column-light',
  'r4-workspace-switcher',
  'r4-repos-mix',
] as const;

type SceneName = (typeof NAMES)[number];

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
  applyDocumentTheme({ theme: 'dark' });
});

type MountParams = {
  readonly name: SceneName;
};

const mount = async ({ name }: MountParams): Promise<Element> => {
  const Scene = U25_R4_WORKSPACE_SCENES[name];
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

type DialogParams = {
  readonly dialog: HTMLElement;
};

const rowNames = ({ dialog }: DialogParams): ReadonlyArray<string | null> =>
  Array.from(dialog.querySelectorAll('[data-repo-row]')).map((row) =>
    row.getAttribute('data-repo-row'),
  );

describe('the round 4 workspace scenes', () => {
  it('registers every scene for the capture', () => {
    expect(Object.keys(U25_R4_WORKSPACE_SCENES).sort()).toEqual([...NAMES].sort());
    for (const name of NAMES) {
      expect(MOCK_SCENES[name]).toBe(U25_R4_WORKSPACE_SCENES[name]);
    }
  });

  it('r4-workspace-switcher puts the current workspace on top and the others in one list', async () => {
    await mount({ name: 'r4-workspace-switcher' });

    const dialog = screen.getByRole('dialog', { name: 'Switch or open a workspace' });
    expect(
      within(dialog).getByRole('region', { name: 'Current workspace: Harborline' }),
    ).toBeDefined();
    const rows = Array.from(dialog.querySelectorAll('[data-workspace-row]')).map((row) =>
      row.getAttribute('data-workspace-row'),
    );
    expect(rows).toEqual(['Northwind', 'Acme', 'Cascadia']);
    expect(within(dialog).getByRole('button', { name: 'Link a repository' })).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Reconnect Cascadia' })).toBeDefined();
  });

  it('r4-repos-mix lists attention first and folds the 18 up to date', async () => {
    await mount({ name: 'r4-repos-mix' });

    const dialog = screen.getByRole('dialog', { name: 'Repositories' });
    expect(rowNames({ dialog })).toEqual([
      'payments-api',
      'ledger-core',
      'notify-relay',
      'risk-models',
    ]);
    const line = dialog.querySelector<HTMLElement>('[data-testid="repo-quiet"] > button');
    expect(line?.textContent).toBe('18 up to date');
    expect(within(dialog).getByRole('button', { name: 'Pull all' })).toBeDefined();
    if (line === null) {
      throw new Error('no quiet line');
    }
    fireEvent.click(line);
    expect(rowNames({ dialog })).toHaveLength(22);
  });

  it.each(NAMES)('%s has no accessibility violation', async (name) => {
    const container = await mount({ name });
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
