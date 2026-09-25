import type { ArtifactId, PlanWithCount, SessionArtifact } from '@goodboy/types';

type Params = {
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly artifactId: ArtifactId | null;
};

export const focusedArtifactTitleOf = ({ plans, artifacts, artifactId }: Params): string | null => {
  if (artifactId === null) {
    return null;
  }
  const plan = plans.find((candidate) => candidate.id === artifactId) ?? null;
  if (plan !== null) {
    return plan.title;
  }
  return artifacts.find((candidate) => candidate.id === artifactId)?.title ?? null;
};
