// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type MountId } from '@goodboy/types';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';

const { carryIntoWorktree, worktreeSetupProposal } = vi.hoisted(() => ({
  carryIntoWorktree: vi.fn(),
  worktreeSetupProposal: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../storyHarness')).dbModuleMock());

vi.mock('../../../../features/worktree/worktree', () => ({
  carryIntoWorktree,
  worktreeSetupProposal,
}));

import { storySpies } from '../../../storyHarness';
import { prepareNewWorktree } from '.';

const PROJECT = aProject({ name: 'payments-api', rootPath: '/repos/payments-api' });
const SESSION = aSession({ workspaceId: aWorkspace({}).id }).id;
const MOUNT = brandId<MountId>({ value: 'mount-payments' });
const CARRY_KEY = 'worktree.carry';
const SETUP_KEY = 'worktree.setup';
const OFFER_KEY = 'worktree.setup-offer.mount-payments';

const saved = new Map<string, string>();
const saveSetting = vi.fn(async (key: string, value: string) => {
  saved.set(key, value);
});
const reportError = vi.fn(async () => undefined);

const prepare = (isReused = false) =>
  prepareNewWorktree({
    saveSetting,
    reportError,
    sessionId: SESSION,
    mountId: MOUNT,
    project: PROJECT,
    created: {
      worktreePath: '/repos/payments-api/.goodboy/worktrees/retry-webhook',
      reused: isReused,
    },
  });

const offerOf = (): unknown => JSON.parse(saved.get(OFFER_KEY) ?? 'null');

beforeEach(() => {
  vi.clearAllMocks();
  saved.clear();
  storySpies.getProjectValue.mockImplementation(async (params: unknown) =>
    typeof params === 'object' && params !== null
      ? (saved.get(String(Reflect.get(params, 'key'))) ?? null)
      : null,
  );
  carryIntoWorktree.mockResolvedValue([]);
  worktreeSetupProposal.mockResolvedValue(null);
});

describe('prepareNewWorktree', () => {
  it('carries exactly the ticked paths and offers the setup it found, never running it', async () => {
    saved.set(CARRY_KEY, JSON.stringify(['.env.local', 'config/local.json']));
    carryIntoWorktree.mockResolvedValue([
      { path: '.env.local', status: 'copied', isSecret: true },
      { path: 'config/local.json', status: 'skipped-exists', isSecret: false },
    ]);
    worktreeSetupProposal.mockResolvedValue({ command: 'pnpm install', source: 'pnpm-lock.yaml' });

    await prepare();

    expect(carryIntoWorktree).toHaveBeenCalledWith({
      repoPath: '/repos/payments-api',
      worktreePath: '/repos/payments-api/.goodboy/worktrees/retry-webhook',
      paths: ['.env.local', 'config/local.json'],
    });
    expect(offerOf()).toEqual({
      command: 'pnpm install',
      carried: 1,
      skipped: 1,
      state: 'offered',
    });
    expect(reportError).not.toHaveBeenCalled();
  });

  it('carries nothing when no path is ticked, so a secret never travels on its own', async () => {
    worktreeSetupProposal.mockResolvedValue({ command: 'pnpm install', source: 'pnpm-lock.yaml' });

    await prepare();

    expect(carryIntoWorktree).not.toHaveBeenCalled();
    expect(offerOf()).toEqual({
      command: 'pnpm install',
      carried: 0,
      skipped: 0,
      state: 'offered',
    });
  });

  it('uses the command the person saved over the proposal, and none when they cleared it', async () => {
    saved.set(SETUP_KEY, 'pnpm install --frozen-lockfile');
    worktreeSetupProposal.mockResolvedValue({ command: 'pnpm install', source: 'pnpm-lock.yaml' });

    await prepare();

    expect(offerOf()).toMatchObject({ command: 'pnpm install --frozen-lockfile' });
    expect(worktreeSetupProposal).not.toHaveBeenCalled();

    saved.clear();
    saved.set(SETUP_KEY, '   ');
    await prepare();

    expect(saved.has(OFFER_KEY)).toBe(false);
  });

  it('says nothing when there is nothing to carry and nothing to propose', async () => {
    await prepare();

    expect(saved.size).toBe(0);
    expect(saveSetting).not.toHaveBeenCalled();
  });

  it('leaves a reused worktree alone', async () => {
    saved.set(CARRY_KEY, JSON.stringify(['.env.local']));

    await prepare(true);

    expect(carryIntoWorktree).not.toHaveBeenCalled();
    expect(saveSetting).not.toHaveBeenCalled();
  });

  it('reports a failure instead of failing the mount', async () => {
    saved.set(CARRY_KEY, JSON.stringify(['.env.local']));
    carryIntoWorktree.mockRejectedValue(new Error('git failed: check-ignore'));

    await expect(prepare()).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't prepare the worktree", sessionId: SESSION }),
    );
    expect(saveSetting).not.toHaveBeenCalled();
  });
});
