// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { BranchSetupOffer } from '.';

const SESSION = brandId<SessionId>({ value: 'session-notify-relay' });
const MOUNT = brandId<MountId>({ value: 'mount-payments' });
const PROJECT = brandId<ProjectId>({ value: 'project-payments' });
const KEY = 'worktree.setup-offer.mount-payments';

const mountOf = (patch: Record<string, unknown> = {}) => ({
  mountId: MOUNT,
  sessionId: SESSION,
  projectId: PROJECT,
  mountName: 'payments',
  worktreePath: '/repos/payments-api/.goodboy/worktrees/retry-webhook',
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'retry-webhook',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present' as const,
  revision: 1,
  ...patch,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    projects: [aProject({ id: PROJECT, name: 'payments-api' })],
    settings: {
      [KEY]: JSON.stringify({ command: 'pnpm install', carried: 2, skipped: 0, state: 'offered' }),
    },
    loadSetting: async () => null,
  });
});

afterEach(cleanup);

const show = () => render(<BranchSetupOffer sessionId={SESSION} mountId={MOUNT} />);

describe('BranchSetupOffer', () => {
  it('draws the setup offer of the active mount with Run and Not now', () => {
    useAppStore.setState({ sessionProjectMounts: { [SESSION]: [mountOf()] } });
    show();

    screen.getByText('Worktree payments-api/retry-webhook is ready.');
    screen.getByRole('button', { name: 'Run' });
    screen.getByRole('button', { name: 'Not now' });
  });

  it('draws nothing for a worktree that is not attached', () => {
    useAppStore.setState({ sessionProjectMounts: { [SESSION]: [mountOf({ isAttached: false })] } });
    show();

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('draws nothing when the mount is not in the session', () => {
    useAppStore.setState({ sessionProjectMounts: { [SESSION]: [] } });
    show();

    expect(screen.queryByRole('status')).toBeNull();
  });
});
