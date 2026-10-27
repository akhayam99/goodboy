// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { NewWorktreesField } from './index';

const PROJECT = aProject({
  workspaceId: aWorkspace({}).id,
  name: 'payments-api',
  rootPath: '/repos/payments-api',
  kind: 'repo',
});
const CARRY_KEY = 'worktree.carry';
const SETUP_KEY = 'worktree.setup';

const CANDIDATES = [
  { path: '.env.local', isDirectory: false, isSecret: true, sizeBytes: 120, isLarge: false },
  { path: 'config/local.json', isDirectory: false, isSecret: false, sizeBytes: 30, isLarge: false },
  { path: 'fixtures', isDirectory: true, isSecret: false, sizeBytes: null, isLarge: true },
];

const stored = new Map<string, string>();
type ValueParams = {
  readonly projectId: string;
  readonly key: string;
  readonly value: string;
};

const saveValue = vi.fn(async ({ key, value }: ValueParams) => {
  stored.set(key, value);
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  stored.clear();
  stubStoryInvoke({
    worktree_carry_candidates: CANDIDATES,
    worktree_setup_proposal: { command: 'pnpm install', source: 'pnpm-lock.yaml' },
  });
  useAppStore.setState({
    readProjectValue: async ({ key }: Pick<ValueParams, 'key'>) => stored.get(key) ?? null,
    writeProjectValue: saveValue,
  });
});

afterEach(cleanup);

const show = async () => {
  render(<NewWorktreesField project={PROJECT} />);
  await screen.findByRole('list', { name: 'Carry into every new branch' });
};

describe('NewWorktreesField', () => {
  it('lists the git-ignored paths unticked, flags the secret and leaves a large folder out', async () => {
    await show();

    expect(screen.getByRole('checkbox', { name: 'Carry .env.local' })).toHaveProperty(
      'checked',
      false,
    );
    screen.getByText('secret: only when ticked');
    expect(screen.getByRole('checkbox', { name: 'Carry fixtures' })).toHaveProperty(
      'disabled',
      true,
    );
    screen.getByText('too large to copy');
  });

  it('prefills the setup from the lockfile, says where it came from and saves nothing until Save', async () => {
    await show();

    expect(screen.getByRole('textbox', { name: 'Setup after creation' })).toHaveProperty(
      'value',
      'pnpm install',
    );
    screen.getByText('proposed from pnpm-lock.yaml');
    expect(saveValue).not.toHaveBeenCalled();
  });

  it('saves only the ticked paths and the setup the person left', async () => {
    await show();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Carry .env.local' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Setup after creation' }), {
      target: { value: 'pnpm install --frozen-lockfile' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(stored.get(SETUP_KEY)).toBe('pnpm install --frozen-lockfile'));
    expect(JSON.parse(stored.get(CARRY_KEY) ?? '[]')).toEqual(['.env.local']);
  });

  it('reads what was saved, shows a path that is gone and saves an empty setup as off', async () => {
    stored.set(CARRY_KEY, JSON.stringify(['config/local.json', 'old/removed.env']));
    stored.set(SETUP_KEY, '');
    await show();

    expect(screen.getByRole('checkbox', { name: 'Carry config/local.json' })).toHaveProperty(
      'checked',
      true,
    );
    screen.getByText('not found here');
    expect(screen.getByRole('textbox', { name: 'Setup after creation' })).toHaveProperty(
      'value',
      '',
    );
    expect(screen.queryByText('proposed from pnpm-lock.yaml')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Carry old/removed.env' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(JSON.parse(stored.get(CARRY_KEY) ?? '[]')).toEqual(['config/local.json']),
    );
    expect(stored.get(SETUP_KEY)).toBe('');
  });

  it('puts the carry list back when the setup write fails after it', async () => {
    stored.set(CARRY_KEY, JSON.stringify(['config/local.json']));
    saveValue.mockImplementationOnce(async ({ key, value }: ValueParams) => {
      stored.set(key, value);
    });
    saveValue.mockRejectedValueOnce(new Error('database is locked'));
    await show();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Carry .env.local' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('alert');
    await waitFor(() =>
      expect(JSON.parse(stored.get(CARRY_KEY) ?? '[]')).toEqual(['config/local.json']),
    );
    expect(stored.has(SETUP_KEY)).toBe(false);
  });

  it('shows the failure of a save and keeps what was typed', async () => {
    saveValue.mockRejectedValueOnce(new Error('database is locked'));
    await show();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByRole('alert');
    expect(screen.getByRole('textbox', { name: 'Setup after creation' })).toHaveProperty(
      'value',
      'pnpm install',
    );
  });
});
