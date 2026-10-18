// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { NOGIT_CHANGES_SCENES } from './changesScenes';

const SETTLE_MS = 3_000;

type SceneName = keyof typeof NOGIT_CHANGES_SCENES;

type MountParams = Readonly<{ name: SceneName }>;

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
});

const settle = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

const mount = async ({ name }: MountParams): Promise<void> => {
  const Scene = NOGIT_CHANGES_SCENES[name];
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await settle();
};

describe('the Changes scenes of acme-notes', () => {
  it('lists the three turns with their titles and the history size', async () => {
    await mount({ name: 'u26-nogit-changes-list-light' });

    expect(screen.getByText('Turn 3 · Tighten the intro')).toBeDefined();
    expect(screen.getByText('Turn 1 · Fix typos')).toBeDefined();
    expect(screen.getByRole('button', { name: 'pricing.md, turn 1' }).textContent).toContain(
      'Restored',
    );
    expect(screen.getByText('Saved versions use 18 MB of 1.0 GB')).toBeDefined();
  });

  it('asks in place when launch-memo.md changed after the turn', async () => {
    await mount({ name: 'u26-nogit-changes-conflict-dark' });

    expect(screen.getByText('launch-memo.md changed after this turn.')).toBeDefined();
  });

  it('restores anyway and offers Undo restore, which puts the text back', async () => {
    await mount({ name: 'u26-nogit-changes-restored-light' });

    expect(screen.getByText('Restored launch-memo.md to before turn 3.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Undo restore' }));
    await settle();
    expect(
      screen.getByRole('button', { name: 'launch-memo.md, turn 3' }).textContent,
    ).not.toContain('Restored');
  });

  it('picks the new summary.md and offers to remove it', async () => {
    await mount({ name: 'u26-nogit-changes-added-dark' });

    expect(screen.getByRole('button', { name: /Remove this new file/ })).toBeDefined();
    expect(screen.getByText('# What people told us')).toBeDefined();
  });

  it('shows the folder card on the overview with the changes so far', async () => {
    await mount({ name: 'u26-nogit-session-overview-light' });

    expect(screen.getByText('In the folder itself, one session at a time')).toBeDefined();
    expect(screen.getByText('4 files over 3 turns')).toBeDefined();
  });

  it('ends each writing turn in the chat with what it changed', async () => {
    await mount({ name: 'u26-nogit-session-chat-dark' });

    expect(screen.getAllByText('Changed 2 files in acme-notes')).toHaveLength(2);
    expect(screen.getByText('Changed 1 file in acme-notes')).toBeDefined();
  });
});
