import type { CloneHostKey } from '../../lib/repoClone/repoCloneTypes';

export type CloneFailureKind =
  | 'unknown_source'
  | 'destination_not_empty'
  | 'destination_not_a_folder'
  | 'network'
  | 'auth_refused'
  | 'not_found'
  | 'failed';

export type CloneFailure = {
  readonly kind: CloneFailureKind;
  readonly message: string;
  readonly host: CloneHostKey | null;
  readonly destination: string;
  readonly suggestion: string | null;
};
