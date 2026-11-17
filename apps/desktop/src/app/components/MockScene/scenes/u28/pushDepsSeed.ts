import {
  brandId,
  type Agent,
  type AgentId,
  type ProviderRunId,
  type TurnEvent,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import type { PushFixOutcome } from '../../../../../store/slices/history/types';
import type { WorktreeDepsCheck } from '../../../../../shared/lib/worktreeDepsCheck';
import { depsInstallScriptId } from '../../../../../shared/utils/depsInstallScriptId';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';
import { FIX_RUN_MOUNT, MOUNT_TARGET, SESSION, seedResolveScene } from '../resolveSeed';

const clock = sceneClock({ anchor: '2026-10-28T10:20:00.000Z' });

export type PushDepsVariant =
  | 'working'
  | 'pushed'
  | 'agent-failed'
  | 'stopped'
  | 'push-failed'
  | 'deps-linked'
  | 'deps-installing';

type Params = {
  readonly variant: PushDepsVariant;
};

const AGENT_ID = brandId<AgentId>({ value: 'mock-push-fixer' });

const READY: WorktreeDepsCheck = {
  state: 'ready',
  command: 'pnpm install --frozen-lockfile',
  source: 'pnpm-lock.yaml',
  folder: 'node_modules',
  isFolderLink: false,
  outside: [],
};

const LINKED: WorktreeDepsCheck = {
  ...READY,
  state: 'outside',
  isFolderLink: true,
  outside: ['node_modules'],
};

type CheckParams = {
  readonly hasStaleDeps: boolean;
};

const checkOf = ({ hasStaleDeps }: CheckParams): WorktreeDepsCheck =>
  hasStaleDeps ? LINKED : READY;

const STATUS_OF: Readonly<Partial<Record<PushDepsVariant, Agent['status']>>> = {
  working: 'running',
  'agent-failed': 'failed',
  stopped: 'stopped',
};

const agentOf = ({ variant }: Params): Agent => ({
  id: AGENT_ID,
  sessionId: SESSION.id,
  ordinal: 4,
  name: 'Fix the push',
  status: STATUS_OF[variant] ?? 'completed',
  kind: 'implementer',
  mountId: MOUNT_TARGET.mountId,
  startedAt: clock.iso({ at: '2026-10-28T10:02:00.000Z' }),
});

const RUN_ID = brandId<ProviderRunId>({ value: 'mock-push-fix-run' });
const STEP_AT = clock.iso({ at: '2026-10-28T10:03:00.000Z' });

const WORKING_TRANSCRIPT: ReadonlyArray<TurnEvent> = [
  {
    kind: 'assistant_text',
    runId: RUN_ID,
    delta: 'The hook fails on a type error in postings.ts.',
    at: STEP_AT,
  },
  {
    kind: 'tool_call_start',
    runId: RUN_ID,
    toolUseId: 'mock-push-typecheck',
    toolName: 'Bash',
    input: { command: 'pnpm typecheck' },
    at: STEP_AT,
  },
];

const outcomeOf = ({ variant }: Params): PushFixOutcome | null => {
  const base = {
    agentId: AGENT_ID,
    sessionId: SESSION.id,
    mountId: MOUNT_TARGET.mountId,
    settledAt: clock.ms({ at: '2026-10-28T10:14:00.000Z' }),
    isClaimed: true,
  };
  if (variant === 'pushed') {
    return {
      ...base,
      kind: 'pushed',
      reason: null,
      followUp: { tone: 'done', sentence: 'Pull request #318 is open.' },
    };
  }
  if (variant === 'agent-failed') {
    return {
      ...base,
      kind: 'agent_failed',
      reason: 'The agent was stopped before it finished.',
      followUp: null,
    };
  }
  if (variant === 'stopped') {
    return {
      ...base,
      kind: 'agent_stopped',
      reason: 'The agent was stopped before it finished.',
      followUp: null,
    };
  }
  if (variant === 'push-failed') {
    return {
      ...base,
      kind: 'push_failed',
      reason: 'pre-push: pnpm knip failed',
      followUp: null,
    };
  }
  return null;
};

export const pushDepsSeed = ({ variant }: Params): void => {
  seedResolveScene({ expandedThreadId: null });
  const outcome = outcomeOf({ variant });
  const hasStaleDeps = variant === 'deps-linked' || variant === 'deps-installing';
  useAppStore.setState((state) => ({
    sessionProjectMounts: { ...state.sessionProjectMounts, [SESSION.id]: [FIX_RUN_MOUNT] },
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [SESSION.id]: [agentOf({ variant })] },
    transcripts:
      variant === 'working'
        ? { ...state.transcripts, [AGENT_ID]: WORKING_TRANSCRIPT }
        : state.transcripts,
    branchPushFixes:
      variant === 'working'
        ? {
            [AGENT_ID]: {
              agentId: AGENT_ID,
              sessionId: SESSION.id,
              mountId: MOUNT_TARGET.mountId,
              identity: {
                worktreePath: FIX_RUN_MOUNT.worktreePath,
                branch: FIX_RUN_MOUNT.branch,
                projectId: FIX_RUN_MOUNT.projectId,
              },
              isForce: false,
              confirmedOnlyOnline: null,
              confirmedRemoteSha: null,
              startedAt: 1,
            },
          }
        : {},
    pushFixOutcomes: outcome === null ? {} : { [MOUNT_TARGET.mountId]: outcome },
    scriptRuns:
      variant === 'deps-installing'
        ? {
            [SESSION.id]: {
              [depsInstallScriptId({ mountId: MOUNT_TARGET.mountId })]: {
                status: 'pending',
                result: null,
                runId: 'mock-deps-install',
                startedAt: 1,
                output: 'Progress: resolved 412, reused 380, downloaded 12\n',
              },
            },
          }
        : {},
  }));
  mockSceneIpc((command) =>
    command === 'worktree_deps_check' ? checkOf({ hasStaleDeps }) : undefined,
  );
};
