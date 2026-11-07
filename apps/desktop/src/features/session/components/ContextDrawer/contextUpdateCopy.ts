import { formatUsd } from '@goodboy/ui';
import type { ContextDrawerSection } from '../../../../store/slices/drawer/state';
import type {
  SummarizerPending,
  SummarizerRound,
  SummarizerSessionStatus,
} from '../../../../store/slices/summaries/state';
import { EFFORT_LABEL, modelLabel } from '../../../chat/utils/chat-constants';
import { formatInteger } from '../../../../shared/utils/formatInteger';
import { countNoun } from '../../../../shared/utils/countNoun';
import { pluralize } from '../../../../shared/utils/pluralize';

export type ContextUpdatePhase = 'idle' | 'queued' | 'running' | 'done' | 'failed';

type PhaseParams = {
  readonly status: SummarizerSessionStatus['status'];
  readonly pending: SummarizerPending;
  readonly round: SummarizerRound | null;
  readonly requestedAt: string | null;
};

export const contextUpdatePhase = ({
  status,
  pending,
  round,
  requestedAt,
}: PhaseParams): ContextUpdatePhase => {
  if (pending.isUpdateQueued) {
    return 'queued';
  }
  if (status === 'running') {
    return 'running';
  }
  if (status === 'error') {
    return 'failed';
  }
  if (requestedAt !== null && round !== null && round.finishedAt >= requestedAt) {
    return 'done';
  }
  return 'idle';
};

type RoundParams = {
  readonly round: SummarizerRound;
};

export const roundTrigger = ({ round }: RoundParams): string => {
  if (round.mode === 'consolidate') {
    return 'a full pass';
  }
  return `after ${countNoun({ count: round.turns, one: 'reply', many: 'replies' })}`;
};

export const roundModel = ({ round }: RoundParams): string => {
  const name = modelLabel(round.model, round.provider);
  if (round.effort === null) {
    return name;
  }
  return `${name} · ${EFFORT_LABEL[round.effort].toLowerCase()} effort`;
};

export const roundUsage = ({ round }: RoundParams): string =>
  `${formatInteger(round.inputTokens)} in · ${formatInteger(round.outputTokens)} out · about ${formatUsd(round.costUsd)}`;

export type RoundChange = Readonly<{ label: string; section: ContextDrawerSection }>;

export const roundChanges = ({ round }: RoundParams): ReadonlyArray<RoundChange> => {
  const changes: Array<RoundChange> = [];
  if (round.changed.goal) {
    changes.push({ label: 'Goal', section: 'goal' });
  }
  if (round.changed.decisions > 0) {
    changes.push({ label: pluralize(round.changed.decisions, 'decision'), section: 'decisions' });
  }
  if (round.changed.summary) {
    changes.push({ label: 'Summary', section: 'summary' });
  }
  return changes;
};

type HintParams = {
  readonly phase: ContextUpdatePhase;
  readonly pendingTurns: number;
  readonly hasContext: boolean;
};

export const contextUpdateHint = ({ phase, pendingTurns, hasContext }: HintParams): string => {
  if (phase === 'queued') {
    return 'Waiting for its turn in the session queue.';
  }
  if (phase === 'running') {
    return '';
  }
  if (phase === 'done') {
    return 'Context is current.';
  }
  if (phase === 'failed') {
    return '';
  }
  if (!hasContext) {
    return 'Updates start after the first agent reply.';
  }
  const since =
    pendingTurns === 0
      ? 'No new replies since the last update.'
      : `${countNoun({ count: pendingTurns, one: 'new reply', many: 'new replies' })} since the last update.`;
  return since;
};
