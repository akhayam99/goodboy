import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { artifactApprovalOf, type ArtifactApprovalView } from './artifactApprovalOf';
import type { DelegationCardModel } from './delegationCardOf';

export type ArtifactLinkModel = Readonly<{
  artifactId: string;
  kindLabel: string;
  title: string;
  revision: number | null;
  approval: ArtifactApprovalView | null;
}>;

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
