import type { Agent, AgentStatus, OpenQuestion, TurnState } from '@goodboy/types';
import type { DotState } from '@goodboy/ui';
import { NAMES } from '../../shared/utils/names';
import { isAgentClosedByUser, isTurnStatePermissionBlocked } from '../session/agent-lifecycle';
import { describeAgentStatus } from '../session/agent-status';
import { resolveAgentRowState, type RowState } from './rowState';
import { rowStateNode, type RowNode } from './rowStateCopy';

export type AgentState = Readonly<{
  row: RowState;
  status: AgentStatus;
  word: string;
  node: RowNode;
  dot: DotState;
  isFinished: boolean;
}>;

type Params = {
  readonly agent: Agent;
  readonly turn: TurnState | null | undefined;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
  readonly isReadyStep?: boolean;
  readonly isMissingArtifact?: boolean;
};

type StatusParams = {
  readonly agent: Agent;
  readonly turn: TurnState | null | undefined;
};

const STOPPED_CONTINUE_WORD = 'Stopped, Continue';

export const NEEDS_PERMISSION_WORD = 'Needs permission';

export const effectiveAgentStatusOf = ({ agent, turn }: StatusParams): AgentStatus =>
  turn?.kind === 'running' ? 'running' : agent.status;

type OldestParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
};

const oldestOf = ({ questions }: OldestParams): OpenQuestion | null =>
  questions.reduce<OpenQuestion | null>(
    (first, question) =>
      first === null || question.createdAt < first.createdAt ? question : first,
    null,
  );

type RowParams = {
  readonly row: RowState;
  readonly turn: TurnState | null | undefined;
};

const NEEDS_PERMISSION_ROW: RowState = {
  phase: 'waiting',
  reason: { kind: 'needsApproval' },
  ask: null,
};

const withPermissionOf = ({ row, turn }: RowParams): RowState => {
  if (!isTurnStatePermissionBlocked({ turnState: turn })) {
    return row;
  }
  if (row.phase === 'closed' || row.phase === 'failed' || row.reason?.kind === 'question') {
    return row;
  }
  return NEEDS_PERMISSION_ROW;
};

type DotParams = {
  readonly row: RowState;
  readonly status: AgentStatus;
  readonly isClosed: boolean;
};

const dotOf = ({ row, status, isClosed }: DotParams): DotState => {
  if (isClosed) {
    return status === 'completed' ? 'done' : 'stopped';
  }
  if (row.reason?.kind === 'question' || row.reason?.kind === 'needsApproval') {
    return 'needsYou';
  }
  switch (status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'done';
    case 'failed':
      return 'failed';
    case 'blocked':
      return 'needsYou';
    case 'stopped':
    case 'skipped':
      return 'stopped';
    case 'pending':
      return 'idle';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
};

type WordParams = {
  readonly row: RowState;
  readonly status: AgentStatus;
  readonly isClosed: boolean;
};

const wordOf = ({ row, status, isClosed }: WordParams): string => {
  if (isClosed) {
    return describeAgentStatus({ status }).label;
  }
  if (row.reason?.kind === 'question') {
    return NAMES.needsYou;
  }
  if (row.reason?.kind === 'needsApproval') {
    return NEEDS_PERMISSION_WORD;
  }
  if (status === 'stopped') {
    return STOPPED_CONTINUE_WORD;
  }
  return describeAgentStatus({ status }).label;
};

export const agentStateOf = ({
  agent,
  turn,
  openQuestions,
  isReadyStep = false,
  isMissingArtifact = false,
}: Params): AgentState => {
  const status = effectiveAgentStatusOf({ agent, turn });
  const isClosed = isAgentClosedByUser({ agent });
  const resolved = resolveAgentRowState({
    agent: status === agent.status ? agent : { ...agent, status },
    isAsking: openQuestions.length > 0,
    question: oldestOf({ questions: openQuestions }),
    isReadyStep,
    isMissingArtifact,
  });
  const row = withPermissionOf({ row: resolved, turn });
  const isFinished = isClosed || row.phase === 'done' || row.phase === 'skipped';
  return {
    row,
    status,
    word: wordOf({ row, status, isClosed }),
    node: rowStateNode({ state: row }),
    dot: dotOf({ row, status, isClosed }),
    isFinished,
  };
};
