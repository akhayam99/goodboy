// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import { importStore, resetStoryStore, STORE_IMPORT_TIMEOUT_MS } from '../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../test/fakeResizeObserver';
import { GenericTerminalPanel, type TerminalDriver } from './index';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('keeps the terminal connected when WebGL2 activation is unavailable', async () => {
  const observers = installFakeResizeObserver();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const driver: TerminalDriver = {
    write: vi.fn(),
    resize: vi.fn(),
    onOutput: vi.fn(async () => () => undefined),
    onExit: vi.fn(async () => () => undefined),
  };
  const { container, unmount } = render(
    <GenericTerminalPanel terminalId="harborline-terminal" driver={driver} isActive={false} />,
  );
  expect(container.querySelector('.xterm')).not.toBeNull();
  await waitFor(() => expect(driver.onOutput).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(driver.onExit).toHaveBeenCalledTimes(1));
  unmount();
  expect(observers.observedCount()).toBe(0);
});
