// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { MOCK_SCENES } from '../..';
import { U25_CHAT_LONG_SCENES } from './chat-long';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

describe('the delivery transcript scene', () => {
  it('shows the operator words as a bubble and the text built for Auto only on request', async () => {
    const Scene = U25_CHAT_LONG_SCENES['transcript-delivery'];
    const { container, findByText, queryByText } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await findByText('The dev server still fails: next: command not found.');
    expect(queryByText(/STATE OF THIS CONVERSATION/)).toBeNull();
    expect(container.textContent).not.toContain('Reserved 0.00 USD');

    fireEvent.click(await findByText('What Auto was told'));
    expect(container.textContent).toContain('STATE OF THIS CONVERSATION');
  });
});

describe('the long transcript scene', () => {
  it('registers under its id', () => {
    expect(MOCK_SCENES['transcript-long']).toBe(U25_CHAT_LONG_SCENES['transcript-long']);
  });

  it('mounts about 150 rows, each with an intrinsic size estimate', async () => {
    const Scene = U25_CHAT_LONG_SCENES['transcript-long'];
    const { container } = render(
      <ToastProvider>
        <Scene />
      </ToastProvider>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('[data-find-root] > li').length).toBeGreaterThanOrEqual(
        100,
      );
    });
    const rows = [...container.querySelectorAll<HTMLElement>('[data-find-root] > li')].filter(
      (row) => row.getAttribute('style') !== null,
    );
    expect(rows.length).toBeGreaterThanOrEqual(100);
    expect(rows.every((row) => row.style.containIntrinsicSize.startsWith('auto '))).toBe(true);
    expect(new Set(rows.map((row) => row.style.containIntrinsicSize)).size).toBeGreaterThan(3);
  });
});
