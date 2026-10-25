import type { CloneFailureKind } from './cloneFailureTypes';

const KINDS: ReadonlyArray<CloneFailureKind> = [
  'unknown_source',
  'destination_not_empty',
  'destination_not_a_folder',
  'network',
  'auth_refused',
  'not_found',
];

type Params = {
  readonly kind: string;
};

export const cloneFailureKindOf = ({ kind }: Params): CloneFailureKind =>
  KINDS.find((known) => known === kind) ?? 'failed';
