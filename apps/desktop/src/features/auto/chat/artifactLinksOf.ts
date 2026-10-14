import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { artifactApprovalOf } from './artifactApprovalOf';
import type { ArtifactLinkModel } from './ArtifactLinkRow';
import type { DelegationCardModel } from './delegationCardOf';

const KIND_LABEL: ReadonlyMap<string, string> = new Map([
  ['plan', 'Plan'],
  ['report', 'Report'],
  ['wireframe', 'Wireframe'],
]);

type Params = {
  readonly view: AutoTreeView;
  readonly card: DelegationCardModel;
};

export const artifactLinksOf = ({ view, card }: Params): ReadonlyArray<ArtifactLinkModel> => {
  if (card.result === null) {
    return [];
  }
  return card.result.artifacts.map((artifact): ArtifactLinkModel => {
    const row = view.artifacts.find(
      (candidate) => candidate.artifact.artifactId === artifact.artifactId,
    );
    return {
      artifactId: artifact.artifactId,
      kindLabel: KIND_LABEL.get(artifact.kind) ?? 'Artifact',
      title: row?.title ?? artifact.title,
      revision: row?.revision ?? artifact.revision,
      approval: row === undefined ? null : artifactApprovalOf({ row }),
    };
  });
};
