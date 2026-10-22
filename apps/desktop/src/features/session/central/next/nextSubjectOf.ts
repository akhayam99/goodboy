import type { ActionCardModel } from './actionCardsOf';

export type NextSubject =
  | Readonly<{ kind: 'plan'; key: string; rootAgentId: string }>
  | Readonly<{ kind: 'pr' | 'branch'; key: string; mountId: string }>
  | Readonly<{ kind: 'own'; key: string }>;

type Params = {
  readonly card: ActionCardModel;
};

type MountParams = {
  readonly mountId: string;
  readonly hasPr: boolean;
};

const PR_KINDS: ReadonlySet<ActionCardModel['kind']> = new Set([
  'fix-checks',
  'resolve-threads',
  'mark-ready',
  'merge-pr',
  'fixRun',
]);

const OWN_KINDS: ReadonlySet<ActionCardModel['kind']> = new Set([
  'rebase-project',
  'close-worktree',
]);

const mountSubjectOf = ({ mountId, hasPr }: MountParams): NextSubject => ({
  kind: hasPr ? 'pr' : 'branch',
  key: `branch:${mountId}`,
  mountId,
});

const ownSubjectOf = ({ card }: Params): NextSubject => ({ kind: 'own', key: `own:${card.id}` });

const planRootOf = ({ card }: Params): string | null => {
  const { source } = card;
  if (
    source.kind === 'auto' &&
    (source.target.kind === 'approve' || source.target.kind === 'blocked')
  ) {
    return source.target.rootAgentId;
  }
  if (source.kind === 'suggestion' && source.suggestion.kind === 'answer-questions') {
    return source.suggestion.payload.rootAgentId;
  }
  return null;
};

export const nextSubjectOf = ({ card }: Params): NextSubject => {
  const rootAgentId = planRootOf({ card });
  if (rootAgentId !== null) {
    return { kind: 'plan', key: `plan:${rootAgentId}`, rootAgentId };
  }
  if (OWN_KINDS.has(card.kind) || card.mountId === null) {
    return ownSubjectOf({ card });
  }
  return mountSubjectOf({ mountId: card.mountId, hasPr: PR_KINDS.has(card.kind) });
};
