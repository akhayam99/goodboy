// @vitest-environment happy-dom

type DragHandler = (event: { readonly payload: unknown }) => void;

const { dragHandlers } = vi.hoisted(() => ({ dragHandlers: new Set<DragHandler>() }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: async () => undefined,
    onDragDropEvent: async (handler: DragHandler) => {
      dragHandlers.add(handler);
      return () => dragHandlers.delete(handler);
    },
  }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
const DROPPED = '/Users/harborline/Desktop/ledger-core-chart.png';
const MISSED = 'Drop the file on a message box to attach it.';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  dragHandlers.clear();
  storySpies.tauriInvoke.mockImplementation((command?: unknown, args?: unknown) => {
    if (command === 'attachment_read_dropped') {
      return Promise.resolve({
        fileName: 'ledger-core-chart.png',
        mimeType: 'image/png',
        dataBase64: 'aGk=',
      });
    }
    if (command === 'attachment_write') {
      return Promise.resolve('.goodboy/attachments/ledger-core-chart.png');
    }
    return queueOnlyInvoke({ command, args });
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const composerOf = async (): Promise<HTMLElement> => {
  const box = await screen.findByPlaceholderText('Message Implementer', undefined, WAIT);
  const composer = box.closest<HTMLElement>('[data-drop-composer]');
  if (composer === null) {
    throw new Error('the session composer is not a drop target');
  }
  return composer;
};

const dropFile = async () => {
  await waitFor(() => expect(dragHandlers.size).toBeGreaterThan(0), WAIT);
  await act(async () => {
    for (const handler of dragHandlers) {
      handler({ payload: { type: 'drop', position: { x: 640, y: 320 }, paths: [DROPPED] } });
    }
  });
};

describe('an image dropped on the agent page', () => {
  it(
    'lands in the session composer while the Runs page under it keeps its own composer',
    async () => {
      render(
        <ToastProvider>
          <P10ChildComposerScene theme="light" />
        </ToastProvider>,
      );
      const composer = await composerOf();
      expect(screen.getByRole('textbox', { name: 'Start a run', hidden: true })).toBeDefined();

      await dropFile();

      expect(
        await within(composer).findByRole('button', { name: 'Remove ledger-core-chart.png' }, WAIT),
      ).toBeDefined();
      expect(screen.queryByText(MISSED)).toBeNull();
    },
    TEST_TIMEOUT_MS,
  );
});
