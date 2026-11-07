import { brandId, type AgentId } from '@goodboy/types';
import type { SessionRun } from '../sessionRunsOf';
import type { WorkBranch } from '../workBranchesOf';

type Params = {
  readonly id: string;
  readonly title?: string;
  readonly dot?: SessionRun['dot'];
  readonly stateWord?: string;
  readonly isFinished?: boolean;
  readonly isArchived?: boolean;
  readonly branches?: ReadonlyArray<WorkBranch>;
  readonly startedAt?: number;
  readonly verb?: SessionRun['verb'];
};

export const aSessionRun = ({
  id,
  title = id,
  dot = 'running',
  stateWord = 'Running',
  isFinished = false,
  isArchived = false,
  branches = [],
  startedAt = 0,
  verb = null,
}: Params): SessionRun => ({
  id,
  kind: 'orchestrated',
  shape: 'plan',
  title,
  origin: 'Workflow · Orchestrated',
  dot,
  stateWord,
  isInProgress: !isFinished,
  isWaiting: dot === 'needsYou' || dot === 'failed',
  isArchived,
  isFinished,
  isUnread: false,
  isRestartStopped: false,
  progress: '',
  startedAt,
  revisingSince: null,
  agentIds: [brandId<AgentId>({ value: `agent-${id}` })],
  open: { kind: 'auto', agentId: brandId<AgentId>({ value: `agent-${id}` }) },
  verb,
  branches,
});
