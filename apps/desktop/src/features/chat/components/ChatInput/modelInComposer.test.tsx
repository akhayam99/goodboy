// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
} from '../../../../store/storyHarness';
import { queueOnlyInvoke } from '../../../../test/queueOnlyInvoke';
import { P10ChildComposerScene } from '../../../../app/components/MockScene/scenes/u36/P10ChildComposerScene';

const WAIT = { timeout: 15_000 };
const TEST_TIMEOUT_MS = 40_000;

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) =>
    queueOnlyInvoke({ command, args }),
  );
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('the model of an agent page', () => {
  it(
    'is picked in the composer, and the Settings line under the title has no model',
    async () => {
      render(
        <ToastProvider>
          <P10ChildComposerScene theme="light" />
        </ToastProvider>,
      );
      const box = await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
      const composer = box.closest<HTMLElement>('[data-drop-composer]');
      if (composer === null) {
        throw new Error('the agent page has no composer box');
      }

      const pickers = screen.getAllByRole('button', { name: /^Model routing:/ });
      expect(pickers).toHaveLength(1);
      expect(within(composer).getByRole('button', { name: /^Model routing:/ })).toBe(pickers[0]);

      await userEvent.click(screen.getByRole('button', { name: 'Run settings' }));
      const settings = await screen.findByRole('group', { name: 'Run settings' }, WAIT);
      expect(within(settings).queryByRole('button', { name: /^Model routing:/ })).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );
});
