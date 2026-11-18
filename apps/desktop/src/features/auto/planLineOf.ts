import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

export type PlanLineEntry = Readonly<{
  row: AutoArtifactLedgerRow;
  version: number;
  isSuperseded: boolean;
}>;

type Params = {
  readonly view: AutoTreeView;
};

type Draft = {
  readonly row: AutoArtifactLedgerRow;
  version: number;
  isSuperseded: boolean;
};

export const planLineOf = ({ view }: Params): ReadonlyArray<PlanLineEntry> => {
  const hidden = new Set<string>(view.hiddenChildIds);
  const drafts: Array<Draft> = view.artifacts
    .filter(
      (row) =>
        row.artifact.kind === 'plan' &&
        row.status !== 'discarded' &&
        !hidden.has(row.artifact.ownerAgentId),
    )
    .sort((first, second) => first.artifact.createdAt - second.artifact.createdAt)
    .map((row) => ({ row, version: row.revision, isSuperseded: row.status === 'superseded' }));
  for (const [index, draft] of drafts.entries()) {
    const owner = view.delegations.find(
      (delegation) => delegation.id === draft.row.artifact.ownerDelegationId,
    );
    if (owner === undefined || owner.reviseOf !== null) {
      continue;
    }
    const replaced = drafts
      .slice(0, index)
      .reverse()
      .find(
        (older) =>
          !older.isSuperseded &&
          older.row.status === 'active' &&
          older.row.artifact.createdAt < owner.createdAt,
      );
    if (replaced === undefined) {
      continue;
    }
    replaced.isSuperseded = true;
    draft.version = draft.row.revision + replaced.version;
  }
  return drafts.reverse().map(({ row, version, isSuperseded }) => ({ row, version, isSuperseded }));
};
