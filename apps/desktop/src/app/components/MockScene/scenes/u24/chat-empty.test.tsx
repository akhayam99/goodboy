// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { U24_CHAT_EMPTY_SCENES } from './chat-empty';

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

const SETTLE_MS = 400;

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

const renderScene = ({ name }: { readonly name: keyof typeof U24_CHAT_EMPTY_SCENES }) => {
  const Scene = U24_CHAT_EMPTY_SCENES[name];
  return render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
};

describe('the u24 chat-empty scenes', () => {
  it('draws one stage with the title, the sentence and the only composer', async () => {
    renderScene({ name: 'chat-empty-stage' });

    await screen.findByRole('heading', { name: /^Ask about / }, { timeout: 4_000 });
    await settle();

    const stage = document.querySelector('[data-chat-stage]');
    expect(stage).not.toBeNull();
    const composers = screen.getAllByRole('textbox', { name: 'Message' });
    expect(composers).toHaveLength(1);
    expect(stage?.contains(composers[0] as HTMLElement)).toBe(true);
    expect(screen.queryAllByText(/Ask anything about/)).toHaveLength(0);
    const list = screen.getByRole('list', { name: 'Suggested questions' });
    expect(list.querySelectorAll('button').length).toBeLessThanOrEqual(3);
  });

  it('asks to add a project when the workspace has none', async () => {
    renderScene({ name: 'chat-empty-noprojects' });

    await screen.findByText('Add a project so answers can read its code.', undefined, {
      timeout: 4_000,
    });
    await settle();

    expect(screen.getByRole('button', { name: 'Add project' })).toBeDefined();
    expect(screen.queryByRole('list', { name: 'Suggested questions' })).toBeNull();
  });
});
