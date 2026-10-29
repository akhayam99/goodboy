import type { AutoDeliveredArtifact, AutoTreeView } from '../../../store/slices/auto-view/state';
import { artifactApprovalOf, type ArtifactApprovalView } from './artifactApprovalOf';
import { artifactLeadOf } from './artifactLeadOf';

export type ArtifactLinkModel = Readonly<{
  artifactId: string;
  kind: string;
  kindLabel: string;
  title: string;
  revision: number | null;
  lead: string | null;
  approval: ArtifactApprovalView | null;
}>;

const KIND_LABEL: ReadonlyMap<string, string> = new Map([
  ['plan', 'Plan'],
  ['report', 'Report'],
  ['wireframe', 'Wireframe'],
]);

type Params = {
  readonly view: AutoTreeView;
  readonly artifacts: ReadonlyArray<AutoDeliveredArtifact>;
};

export const artifactLinksOf = ({ view, artifacts }: Params): ReadonlyArray<ArtifactLinkModel> =>
  artifacts.map((artifact): ArtifactLinkModel => {
    const row = view.artifacts.find(
      (candidate) => candidate.artifact.artifactId === artifact.artifactId,
    );
    return {
      artifactId: artifact.artifactId,
      kind: artifact.kind,
      kindLabel: KIND_LABEL.get(artifact.kind) ?? 'Artifact',
      title: row?.title ?? artifact.title,
      revision: row?.revision ?? artifact.revision,
      lead:
        row === undefined
          ? null
          : artifactLeadOf({ kind: artifact.kind, sourceText: row.sourceText }),
      approval: row === undefined ? null : artifactApprovalOf({ row }),
    };
  });
