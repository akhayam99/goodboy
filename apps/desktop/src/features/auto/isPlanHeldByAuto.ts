import type { ArtifactId } from '@goodboy/types';
import type { AutoTreeView } from '../../store/slices/auto-view/state';

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly planId: ArtifactId;
};

export const isPlanHeldByAuto = ({ views, planId }: Params): boolean =>
  views.some((view) =>
    view.artifacts.some(
      (row) => row.artifact.kind === 'plan' && row.artifact.artifactId === planId,
    ),
  );
