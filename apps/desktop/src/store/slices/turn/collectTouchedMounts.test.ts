import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AgentId,
  IsoDateTime,
  MountId,
  ProjectId,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';

const { changedFiles, otherTurn } = vi.hoisted(() => ({
  changedFiles: vi.fn(),
  otherTurn: vi.fn(),
}));

vi.mock('@goodboy/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/db')>()),
  hasOtherSessionTurnSince: otherTurn,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/worktree/worktree', () => ({
  worktreeChangedFiles: changedFiles,
}));

import type { GetFn } from '../../slice-types';
import { collectTouchedMounts } from './collectTouchedMounts';

const SESSION_ID = 'session-touched' as SessionId;
const AGENT_ID = 'agent-web' as AgentId;
const OTHER_ID = 'agent-api' as AgentId;

const mount = (mountId: string, worktreePath: string): SessionProjectMount => ({
  mountId: mountId as MountId,
  sessionId: SESSION_ID,
  projectId: `project-${mountId}` as ProjectId,
  mountName: mountId,
  worktreePath,
  lastWorktreePath: null,
  repoRoot: worktreePath,
  branch: 'feat/checkout',
  baseBranch: null,
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 0,
});

const WEB = mount('mount-web', '/repo/acme-web');
const API = mount('mount-api', '/repo/acme-api');

type StateParams = {
  readonly isOtherRunning: boolean;
};

const getFor =
  ({ isOtherRunning }: StateParams): GetFn =>
  () =>
    ({
      sessionPhaseRuns: { [SESSION_ID]: [{ id: AGENT_ID }, { id: OTHER_ID }] },
      agentTurnState: isOtherRunning ? { [OTHER_ID]: { kind: 'running' } } : {},
    }) as unknown as ReturnType<GetFn>;

const collect = ({ isOtherRunning }: StateParams) =>
  collectTouchedMounts({
    get: getFor({ isOtherRunning }),
    sessionId: SESSION_ID,
    agentId: AGENT_ID,
    mounts: [WEB, API],
    workingDir: WEB.worktreePath,
    editedPaths: ['src/cart.ts'],
    before: Promise.resolve(
      new Map([
        [WEB.mountId, ''],
        [API.mountId, ''],
      ]),
    ),
    startedAt: '2026-09-25T10:00:00.000Z' as IsoDateTime,
  });

beforeEach(() => {
  changedFiles.mockReset();
  otherTurn.mockReset();
  changedFiles.mockImplementation(async ({ worktreePath }: { readonly worktreePath: string }) => ({
    paths: [],
    additions: 0,
    deletions: 0,
    numstat: worktreePath === API.worktreePath ? '3\t0\tpromo.ts' : '',
  }));
  otherTurn.mockResolvedValue(false);
});

describe('collectTouchedMounts', () => {
  it('adds a worktree whose change set moved while the agent ran alone', async () => {
    expect(await collect({ isOtherRunning: false })).toEqual([WEB.mountId, API.mountId]);
  });

  it('keeps only reported edits while another agent of the session is running', async () => {
    expect(await collect({ isOtherRunning: true })).toEqual([WEB.mountId]);
    expect(changedFiles).not.toHaveBeenCalled();
  });

  it('keeps only reported edits when another agent closed a turn during this one', async () => {
    otherTurn.mockResolvedValue(true);

    expect(await collect({ isOtherRunning: false })).toEqual([WEB.mountId]);
  });

  it('falls back to reported edits when the overlap check fails', async () => {
    otherTurn.mockRejectedValue(new Error('db closed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await collect({ isOtherRunning: false })).toEqual([WEB.mountId]);
  });
});
