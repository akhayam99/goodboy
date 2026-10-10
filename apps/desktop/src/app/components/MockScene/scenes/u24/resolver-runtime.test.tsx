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
import { U24_RESOLVER_RUNTIME_SCENES } from './resolver-runtime';

const SETTLE_MS = 2_000;

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
});

const mount = async (name: string): Promise<Element> => {
  const Scene = U24_RESOLVER_RUNTIME_SCENES[name];
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

describe('the resolver runtime scenes', () => {
  it('registers both scenes for the capture', () => {
    expect(Object.keys(U24_RESOLVER_RUNTIME_SCENES).sort()).toEqual([
      'models-saved-project',
      'turn-override-off',
    ]);
    expect(MOCK_SCENES['turn-override-off']).toBe(U24_RESOLVER_RUNTIME_SCENES['turn-override-off']);
  });

  it('models-saved-project says the saved settings no longer apply and lists both projects', async () => {
    await mount('models-saved-project');

    expect(screen.getByText('Model settings 2 projects had are saved')).toBeDefined();
    expect(screen.getByText('They no longer apply.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));

    const list = screen.getByRole('list', { name: 'Projects with saved model settings' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(
        within(row).getByRole('button', { name: /^Apply the saved settings of / }),
      ).toBeDefined();
      expect(
        within(row).getByRole('button', { name: /^Discard the saved settings of / }),
      ).toBeDefined();
    }
  });

  it('turn-override-off names the provider and the reason in one calm note', async () => {
    await mount('turn-override-off');

    expect(
      screen.getByText(
        'Running on Cursor because you picked it for this turn. Cursor is Off in Settings.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('The turn stopped')).toBeNull();
  });

  it.each(Object.keys(U24_RESOLVER_RUNTIME_SCENES))(
    '%s has no accessibility violation once drawn',
    async (name) => {
      const container = await mount(name);
      vi.useRealTimers();

      const { violations } = await runA11yCheck(container);

      expect(violations.map((violation) => violation.id)).toEqual([]);
    },
  );
});
