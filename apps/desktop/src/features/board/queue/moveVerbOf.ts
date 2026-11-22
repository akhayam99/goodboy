import type { SessionAttentionReason } from '@goodboy/types';

const VERB_BY_REASON: Partial<Record<SessionAttentionReason, string>> = {
  'plan-approval': 'Review plan',
  'run-stopped': 'Open run',
  'run-paused-at-limit': 'Open run',
  'run-waits-for-go': 'Open run',
};

type Params = {
  readonly reason: SessionAttentionReason;
};

export const moveVerbOf = ({ reason }: Params): string =>
  VERB_BY_REASON[reason] ?? 'Open in session';
