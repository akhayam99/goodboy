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
import { U23P24_ERROR_RECOVERY_SCENES } from './error-recovery';

const SETTLE_MS = 2_000;
const SCENE = 'u23p24-error-recovery';

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
  const Scene = U23P24_ERROR_RECOVERY_SCENES[SCENE];
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

describe('the error recovery scene', () => {
  it('registers the scene for the capture', () => {
    expect(MOCK_SCENES[SCENE]).toBe(U23P24_ERROR_RECOVERY_SCENES[SCENE]);
  });

  it('offers each error its way out as a button on the row', async () => {
    await mount();

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    const rowAt = ({ index }: { index: number }) => within(rows[index] ?? document.body);
    rowAt({ index: 0 }).getByRole('button', { name: 'Retry push' });
    rowAt({ index: 1 }).getByRole('button', { name: 'Reconnect GitLab' });
    rowAt({ index: 2 }).getByRole('button', { name: 'Open settings' });
    expect(rowAt({ index: 3 }).queryByRole('button', { name: /Retry|Open|Show/ })).toBeNull();
    rowAt({ index: 4 }).getByRole('button', { name: 'Show in Finder' });
  });

  it('has no accessibility violation', async () => {
    const container = await mount();
    vi.useRealTimers();

    const { violations } = await runA11yCheck(container);

    expect(violations.map((violation) => violation.id)).toEqual([]);
  });
});
