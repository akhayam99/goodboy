import type { PlanWithCount, SessionArtifact } from '@goodboy/types';
import {
  GENERATED_ARTIFACT_KINDS,
  type ArtifactFilter,
  type ArtifactGeneration,
  type GeneratedArtifactKind,
} from './artifactCollection';

export type ArtifactGroup = Readonly<{
  kind: GeneratedArtifactKind;
  artifacts: ReadonlyArray<SessionArtifact>;
  generations: ReadonlyArray<ArtifactGeneration>;
}>;

type GroupParams = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
  generations: ReadonlyArray<ArtifactGeneration>;
}>;

export const artifactGroups = ({
  artifacts,
  generations,
}: GroupParams): ReadonlyArray<ArtifactGroup> =>
  GENERATED_ARTIFACT_KINDS.map((kind) => ({
    kind,
    artifacts: artifacts.filter((artifact) => artifact.kind === kind),
    generations: generations.filter((generation) => generation.kind === kind),
  }));

type CountParams = Readonly<{
  plans: ReadonlyArray<PlanWithCount>;
  groups: ReadonlyArray<ArtifactGroup>;
}>;

export const artifactCounts = ({
  plans,
  groups,
}: CountParams): Readonly<Record<ArtifactFilter, number>> => {
  const countOf = (kind: GeneratedArtifactKind): number => {
    const group = groups.find((entry) => entry.kind === kind);
    return group === undefined ? 0 : group.artifacts.length + group.generations.length;
  };
  return {
    plan: plans.length,
    report: countOf('report'),
    wireframe: countOf('wireframe'),
    all: plans.length + countOf('report') + countOf('wireframe'),
  };
};

type ShownParams = Readonly<{
  filter: ArtifactFilter;
  kind: ArtifactFilter;
  counts: Readonly<Record<ArtifactFilter, number>>;
}>;

export const isArtifactSectionShown = ({ filter, kind, counts }: ShownParams): boolean =>
  (filter === 'all' || filter === kind) && counts[kind] > 0;
