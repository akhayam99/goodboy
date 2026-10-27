import type { ArtifactProvenance } from '@goodboy/types';

export type MockMountDiffStat = {
  readonly additions: number;
  readonly deletions: number;
};

type MountDiffStatParams = {
  readonly worktreePath: string;
};

type ArtifactProvenanceParams = {
  readonly agentId: string;
};

export type MockFixtureReaders = {
  readonly mountDiffStat: (params: MountDiffStatParams) => MockMountDiffStat | null;
  readonly artifactProvenance: (params: ArtifactProvenanceParams) => ArtifactProvenance | null;
};

type RegisterParams = {
  readonly readers: MockFixtureReaders;
};

const NO_FIXTURES: MockFixtureReaders = {
  mountDiffStat: () => null,
  artifactProvenance: () => null,
};

let registered: MockFixtureReaders = NO_FIXTURES;

export const registerMockFixtures = ({ readers }: RegisterParams): void => {
  registered = readers;
};

export const readMockMountDiffStat = ({
  worktreePath,
}: MountDiffStatParams): MockMountDiffStat | null => registered.mountDiffStat({ worktreePath });

export const readMockArtifactProvenance = ({
  agentId,
}: ArtifactProvenanceParams): ArtifactProvenance | null =>
  registered.artifactProvenance({ agentId });
