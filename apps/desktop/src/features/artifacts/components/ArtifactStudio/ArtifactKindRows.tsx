import type { AgentId, ArtifactId, SessionArtifact } from '@goodboy/types';
import type { ArtifactGeneration } from '../../artifactCollection';
import { ArtifactGenerationRow } from './ArtifactGenerationRow';
import { ArtifactRow } from './ArtifactRow';

type Props = {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly generations: ReadonlyArray<ArtifactGeneration>;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
  readonly onSelectGeneration: (agentId: AgentId) => void;
};

export const ArtifactKindRows = ({
  artifacts,
  generations,
  onSelectArtifact,
  onSelectGeneration,
}: Props) => (
  <ul className="flex flex-col gap-2">
    {generations.map((generation) => (
      <li key={generation.agentId}>
        <ArtifactGenerationRow
          generation={generation}
          onSelect={() => onSelectGeneration(generation.agentId)}
        />
      </li>
    ))}
    {artifacts.map((artifact) => (
      <li key={artifact.id}>
        <ArtifactRow artifact={artifact} onSelect={() => onSelectArtifact(artifact.id)} />
      </li>
    ))}
  </ul>
);
