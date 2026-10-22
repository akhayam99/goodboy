import type { AutoStuckKind } from './autoStuckKindOf';

type Params = {
  readonly kind: AutoStuckKind;
};

const VERB: Readonly<Record<AutoStuckKind, string>> = {
  neverStarted: 'never started',
  failed: 'failed',
  timedOut: 'timed out',
  childBlocked: 'is blocked',
};

export const autoStuckVerbOf = ({ kind }: Params): string => VERB[kind];
