import type { AutoDelegation, AutoOutboxRow, AutoTree } from '@goodboy/db';

type Params = {
  readonly accepted: ReadonlyArray<AutoOutboxRow>;
  readonly tree: Pick<AutoTree, 'generation'>;
  readonly delegation: Pick<AutoDelegation, 'createdAt'>;
};

export const childRowsOf = ({ accepted, tree, delegation }: Params): ReadonlyArray<AutoOutboxRow> =>
  accepted.filter(
    (row) =>
      row.kind === 'user' &&
      row.generation === tree.generation &&
      row.createdAt <= delegation.createdAt,
  );
