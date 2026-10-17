import { ExploreScene } from '../audit/ExploreScene';
import { ArtifactPlanCommentsScene } from '../ArtifactPlanCommentsScene';

const OPEN_FOLDERS: ReadonlyArray<string> = ['src', 'settlement'];

export const U25_POLISH_A_SCENES = {
  'artifact-plan-fill': () => <ArtifactPlanCommentsScene hasComments={false} />,
  'explore-dot-warning': () => <ExploreScene changes="some" openLabels={OPEN_FOLDERS} />,
};
