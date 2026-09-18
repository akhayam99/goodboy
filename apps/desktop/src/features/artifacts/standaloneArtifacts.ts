import type { SessionArtifact } from '@goodboy/types';

type Params = Readonly<{
  artifacts: ReadonlyArray<SessionArtifact>;
}>;

export const standaloneArtifacts = ({ artifacts }: Params): ReadonlyArray<SessionArtifact> =>
  artifacts.filter((artifact) => artifact.kind !== 'plan');
