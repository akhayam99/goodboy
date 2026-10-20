import type { AutoStuckKind } from './autoStuckKindOf';

type Params = {
  readonly title: string;
  readonly kind: AutoStuckKind;
};

const VERB: Readonly<Record<AutoStuckKind, string>> = {
  neverStarted: 'never started',
  failed: 'stopped',
  timedOut: 'timed out',
  childBlocked: 'is blocked',
};

export const autoStuckLineOf = ({ title, kind }: Params): string => `"${title}" ${VERB[kind]}`;
