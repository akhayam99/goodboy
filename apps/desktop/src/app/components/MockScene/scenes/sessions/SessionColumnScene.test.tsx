// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import type { ComponentType } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { SessionHoverScene } from './SessionHoverScene';
import { SessionSwitcherScene } from './SessionSwitcherScene';
import { SessionsMenuScene } from './SessionsMenuScene';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const SCENES: ReadonlyArray<readonly [string, ComponentType]> = [
  ['sessions-menu', SessionsMenuScene],
  ['session-hover', SessionHoverScene],
  ['session-switcher', SessionSwitcherScene],
];

describe('the session column scenes render the open session', () => {
  it.each(SCENES)(
    '%s shows the overview of the open session, never a loading skeleton',
    async (_key, Scene) => {
      render(
        <ToastProvider>
          <Scene />
        </ToastProvider>,
      );
      const main = await waitFor(() => {
        const node = document.querySelector<HTMLElement>('[data-drawer-main]');
        if (node === null) {
          throw new Error('no main pane yet');
        }
        return node;
      });
      await waitFor(() => expect(main.textContent).toContain('Fix webhook retries'));
      expect(screen.queryByLabelText('Loading session overview')).toBeNull();
    },
  );
});
