// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { clearMocks } from '@tauri-apps/api/mocks';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../../store/storyHarness';
import { MOCK_SCENES } from '../..';
import { U23P25_NEW_WORKTREE_SCENES } from './NewWorktreeScenes';

const WAIT = { timeout: 15_000 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  clearMocks();
});

type SceneId = keyof typeof U23P25_NEW_WORKTREE_SCENES;

const show = ({ id }: { readonly id: SceneId }) => {
  const Scene = U23P25_NEW_WORKTREE_SCENES[id];
  render(<Scene />);
};

describe('the new worktree scenes', () => {
  it('registers both for the capture', () => {
    expect(MOCK_SCENES['p25-worktree-offer']).toBe(
      U23P25_NEW_WORKTREE_SCENES['p25-worktree-offer'],
    );
    expect(MOCK_SCENES['p25-worktree-carry']).toBe(
      U23P25_NEW_WORKTREE_SCENES['p25-worktree-carry'],
    );
  });

  it('p25-worktree-offer says the worktree is ready and runs the setup only on Run', async () => {
    show({ id: 'p25-worktree-offer' });

    await screen.findByText('Worktree payments-api/retry-webhook is ready.', undefined, WAIT);
    screen.getByText('Copied 2 files. Setup proposed: pnpm install.');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await screen.findByText('Setup finished: pnpm install.', undefined, WAIT);
  });

  it('p25-worktree-carry lists the ignored paths with the secret marked and the setup prefilled', async () => {
    show({ id: 'p25-worktree-carry' });

    await screen.findByRole('list', { name: 'Carry into every new branch' }, WAIT);
    screen.getByText('secret: only when ticked');
    expect(screen.getByRole('textbox', { name: 'Setup after creation' })).toHaveProperty(
      'value',
      'pnpm install',
    );
    screen.getByText('proposed from pnpm-lock.yaml');
  });
});
