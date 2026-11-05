import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoLevel } from '@goodboy/core/auto';

type Params = {
  readonly row: AutoArtifactLedgerRow;
  readonly level: AutoLevel | undefined;
};

export const planAwaitsYou = ({ row, level }: Params): boolean =>
  row.artifact.kind === 'plan' &&
  row.artifact.approvalState === 'needs_approval' &&
  row.artifact.openReviseDelegationId === null &&
  row.status !== 'consumed' &&
  level !== 'run';
