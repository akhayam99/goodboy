import type { SessionId } from '@goodboy/types';
import type { RebaseSuggestionTarget } from '../../../suggestions/types';
import type { ActionCardModel } from './actionCardsOf';
import type { NextGroupModel } from './nextGroupsOf';

export type NextBulk =
  | Readonly<{ kind: 'retry'; label: string; rows: ReadonlyArray<ActionCardModel> }>
  | Readonly<{
      kind: 'rebase';
      label: string;
      sessionId: SessionId;
      targets: ReadonlyArray<RebaseSuggestionTarget>;
    }>;

type Params = {
  readonly group: NextGroupModel;
};

type CardParams = {
  readonly card: ActionCardModel;
};

const MIN_BULK = 2;

const isRetryable = ({ card }: CardParams): boolean => {
  const { source } = card;
  return (
    source.kind === 'auto' &&
    source.target.canRetry &&
    source.target.kind !== 'approve' &&
    source.target.kind !== 'blocked'
  );
};

export const nextBulkOf = ({ group }: Params): NextBulk | null => {
  if (group.id === 'fix') {
    const rows = group.rows.filter((card) => isRetryable({ card }));
    return rows.length < MIN_BULK ? null : { kind: 'retry', label: `Retry ${rows.length}`, rows };
  }
  if (group.id !== 'update') {
    return null;
  }
  for (const card of group.rows) {
    const { source } = card;
    if (
      source.kind === 'suggestion' &&
      source.suggestion.kind === 'rebase-project' &&
      source.suggestion.payload.targets.length >= MIN_BULK
    ) {
      return {
        kind: 'rebase',
        label: 'Rebase all',
        sessionId: source.suggestion.sessionId,
        targets: source.suggestion.payload.targets,
      };
    }
  }
  return null;
};
