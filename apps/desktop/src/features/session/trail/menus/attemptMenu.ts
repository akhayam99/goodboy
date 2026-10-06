import type { ResolveAttempt } from '@goodboy/types';
import type { CrumbMenuAction, CrumbMenuModel, CrumbMenuRow, CrumbState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { RESOLVE_WORD_LABEL } from '../../../resolve/commentProjection';
import { attemptFailureSentence } from '../../../resolve/failureSentence';

const ATTEMPT_STATE = {
  queued: { word: 'Waiting', tone: 'neutral' },
  running: { word: RESOLVE_WORD_LABEL.working, tone: 'info' },
  waiting: { word: RESOLVE_WORD_LABEL.needs_you, tone: 'warning' },
  finished: { word: RESOLVE_WORD_LABEL.ready, tone: 'success' },
  failed: { word: RESOLVE_WORD_LABEL.couldnt_fix, tone: 'danger' },
  cancelled: { word: 'Stopped', tone: 'neutral' },
} satisfies Record<ResolveAttempt['phase'], CrumbState>;

const stateOfAttempt = ({ attempt }: { readonly attempt: ResolveAttempt }): CrumbState =>
  attempt.phase === 'finished' && attempt.failureCause != null
    ? ATTEMPT_STATE.failed
    : ATTEMPT_STATE[attempt.phase];

const secondaryOfAttempt = ({
  attempt,
  age,
}: {
  readonly attempt: ResolveAttempt;
  readonly age: string;
}): string => {
  const isCouldntFix =
    attempt.phase === 'failed' ||
    attempt.phase === 'cancelled' ||
    (attempt.phase === 'finished' && attempt.failureCause != null);
  return isCouldntFix ? `${attemptFailureSentence({ attempt })} · ${age}` : `Resolver · ${age}`;
};

type AttemptParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly threadLabel: string;
  readonly currentAgentId: string | null;
  readonly ageOf: (ms: number) => string;
  readonly actions: ReadonlyArray<CrumbMenuAction>;
  readonly onSelect: (attempt: ResolveAttempt) => void;
};

export const attemptMenu = ({
  attempts,
  threadLabel,
  currentAgentId,
  ageOf,
  actions,
  onSelect,
}: AttemptParams): CrumbMenuModel => {
  const ordered = [...attempts].sort((first, second) => second.createdAt - first.createdAt);
  const rows = ordered.map((attempt, index): CrumbMenuRow => ({
    id: attempt.id,
    lead: { kind: 'icon', icon: CONCEPT_ICONS.resolve },
    label: `Attempt ${ordered.length - index}`,
    secondary: secondaryOfAttempt({ attempt, age: ageOf(attempt.createdAt) }),
    metaA: attempt.model,
    state: stateOfAttempt({ attempt }),
    isCurrent: attempt.agentId === currentAgentId,
    isDisabled: false,
    indent: 0,
    onSelect: () => onSelect(attempt),
  }));
  return {
    title: 'Attempts',
    context: threadLabel,
    count: rows.length,
    triggerLabel: 'Switch attempt',
    groups: [{ id: 'attempts', label: null, rows }],
    actions: actions.slice(0, 2),
    width: 'regular',
    filterPlaceholder: null,
  };
};
