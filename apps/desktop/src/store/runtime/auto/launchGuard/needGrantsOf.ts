import {
  isPathInPattern,
  needSubjectOf,
  PROTECTED_FILE_PATTERNS,
  storedLaunchGuardOf,
  type ChildClosing,
} from '@goodboy/core/auto';
import type {
  AutoAttempt,
  AutoDelegation,
  AutoGrantId,
  AutoOutcome,
  NewAutoGrant,
} from '@goodboy/db';
import { brandId } from '@goodboy/types';

type Params = {
  readonly newId: () => string;
  readonly nowMs: number;
  readonly delegation: AutoDelegation;
  readonly attempt: AutoAttempt;
  readonly closing: ChildClosing;
  readonly outcome: AutoOutcome;
};

export const needGrantsOf = ({
  newId,
  nowMs,
  delegation,
  attempt,
  closing,
  outcome,
}: Params): ReadonlyArray<NewAutoGrant> => {
  const kind = closing.returned?.needs?.kind;
  const guard = storedLaunchGuardOf({ writeSet: attempt.writeSet });
  if (outcome !== 'blocked' || guard === null) {
    return [];
  }
  if (kind !== 'dependency' && kind !== 'protected_file') {
    return [];
  }
  const subject = needSubjectOf({ kind, request: closing.returned?.request ?? '' });
  if (subject === null) {
    return [];
  }
  const isGuarded =
    kind === 'dependency'
      ? guard.dependencies === 'ask'
      : guard.protectedFiles === 'ask' &&
        PROTECTED_FILE_PATTERNS.some((pattern) => isPathInPattern({ pattern, path: subject }));
  if (!isGuarded) {
    return [];
  }
  return [
    {
      id: brandId<AutoGrantId>({ value: newId() }),
      treeId: attempt.treeId,
      delegationId: delegation.id,
      attemptId: attempt.id,
      textVersion: null,
      kind,
      subject,
      nowMs,
    },
  ];
};
