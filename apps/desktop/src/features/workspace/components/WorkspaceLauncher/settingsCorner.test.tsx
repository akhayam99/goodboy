// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { settingsOverlayFromEvent } from '../../../../app/hooks/useAppOverlays/eventDetail';
import { WorkspaceLauncher } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

describe('WorkspaceLauncher settings corner', () => {
  it('opens the settings home', () => {
    const opened: Array<unknown> = [];
    const onOpen = (event: Event) => opened.push(settingsOverlayFromEvent(event));
    window.addEventListener('goodboy:open-settings', onOpen);
    render(<WorkspaceLauncher />);

    fireEvent.click(screen.getByRole('button', { name: /^Open settings/ }));

    window.removeEventListener('goodboy:open-settings', onOpen);
    expect(opened).toEqual([
      expect.objectContaining({
        kind: 'settings',
        focus: expect.objectContaining({ scope: 'home' }),
      }),
    ]);
  });
});
