import type { AutoArtifactLedgerRow } from '@goodboy/db';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { planLineOf } from '../planLineOf';
import { artifactApprovalOf, type ArtifactApprovalView } from './artifactApprovalOf';
import { AUTO_STATE_TONE } from './autoStateTone';

type Params = {
  readonly view: AutoTreeView;
  readonly row: AutoArtifactLedgerRow;
};

export const planApprovalInViewOf = ({ view, row }: Params): ArtifactApprovalView | null => {
  const entry = planLineOf({ view }).find(
    (candidate) => candidate.row.artifact.artifactId === row.artifact.artifactId,
  );
  if (entry?.isSuperseded === true) {
    return { word: 'Superseded', tone: AUTO_STATE_TONE.artifact, state: 'superseded' };
  }
  return artifactApprovalOf({ row, level: view.level });
};
