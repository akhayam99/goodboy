import type { ResolveAttempt } from '@goodboy/types';
import type { CrumbMenuModel, CrumbMenuRow, CrumbState } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

const ATTEMPT_STATE = {
  queued: { word: 'Waiting', tone: 'neutral' },
  running: { word: 'Working', tone: 'info' },
  waiting: { word: 'Needs you', tone: 'warning' },
  finished: { word: 'Reply ready', tone: 'success' },
  failed: { word: 'Failed', tone: 'danger' },
  cancelled: { word: 'Stopped', tone: 'neutral' },
} satisfies Record<ResolveAttempt['phase'], CrumbState>;

type AttemptParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly threadLabel: string;
  readonly currentAgentId: string | null;
  readonly ageOf: (ms: number) => string;
  readonly onSelect: (attempt: ResolveAttempt) => void;
};

export const attemptMenu = ({
  attempts,
  threadLabel,
  currentAgentId,
  ageOf,
  onSelect,
}: AttemptParams): CrumbMenuModel => {
  const ordered = [...attempts].sort((first, second) => second.createdAt - first.createdAt);
  const rows = ordered.map((attempt, index): CrumbMenuRow => ({
    id: attempt.id,
    lead: { kind: 'icon', icon: CONCEPT_ICONS.resolve },
    label: `Attempt ${ordered.length - index}`,
    secondary: `Resolver · ${ageOf(attempt.createdAt)}`,
    metaA: attempt.model,
    state: ATTEMPT_STATE[attempt.phase],
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
    actions: [],
    width: 'regular',
    filterPlaceholder: null,
  };
};
