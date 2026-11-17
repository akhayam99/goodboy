import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';

type Params = {
  readonly view: AutoTreeView;
  readonly row: AutoArtifactLedgerRow;
};

export const isPlanChangeSentOf = ({ view, row }: Params): boolean => {
  const sent = view.sentChange ?? null;
  return (
    sent !== null && sent.artifactId === row.artifact.artifactId && sent.revision === row.revision
  );
};
