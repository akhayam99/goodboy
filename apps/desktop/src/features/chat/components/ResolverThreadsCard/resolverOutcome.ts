import { RESOLVE_WORD_LABEL } from '../../../resolve/commentProjection';
import type { ResolverThreadVerdictKind } from './resolverThreadVerdicts';

export type ResolverOutcome = 'fixed' | 'no_change' | 'explained' | 'closed' | 'needs_you';

export const RESOLVER_OUTCOME_LABEL: Record<ResolverOutcome, string> = {
  fixed: RESOLVE_WORD_LABEL.to_review.toLowerCase(),
  no_change: 'no change',
  explained: 'explained',
  closed: 'closed',
  needs_you: RESOLVE_WORD_LABEL.question.toLowerCase(),
};

export const RESOLVER_OUTCOME_ORDER: ReadonlyArray<ResolverOutcome> = [
  'fixed',
  'no_change',
  'explained',
  'closed',
  'needs_you',
];

const OUTCOME_BY_KIND: Record<ResolverThreadVerdictKind, ResolverOutcome> = {
  resolved: 'fixed',
  wontfix: 'no_change',
  analyzed: 'explained',
  open: 'needs_you',
};

type Params = Readonly<{
  kind: ResolverThreadVerdictKind;
  isClosed: boolean;
}>;

export const resolverOutcome = ({ kind, isClosed }: Params): ResolverOutcome =>
  isClosed ? 'closed' : OUTCOME_BY_KIND[kind];
