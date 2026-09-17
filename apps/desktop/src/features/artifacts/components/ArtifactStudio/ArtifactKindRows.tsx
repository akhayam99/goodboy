import type { AgentId, ArtifactId, SessionArtifact } from '@goodboy/types';
import type { ArtifactGeneration } from '../../artifactCollection';
import { ArtifactGenerationRow } from './ArtifactGenerationRow';
import { ArtifactRow } from './ArtifactRow';

type Props = {
  readonly artifacts: ReadonlyArray<SessionArtifact>;
  readonly generations: ReadonlyArray<ArtifactGeneration>;
  readonly selectedArtifactId: ArtifactId | null;
  readonly selectedGenerationAgentId: AgentId | null;
  readonly isCompact: boolean;
  readonly onSelectArtifact: (artifactId: ArtifactId) => void;
  readonly onSelectGeneration: (generation: ArtifactGeneration) => void;
  readonly onStopGeneration: (generation: ArtifactGeneration) => void;
  readonly onRetryGeneration: (generation: ArtifactGeneration) => void;
};

export const ArtifactKindRows = ({
  artifacts,
  generations,
  selectedArtifactId,
  selectedGenerationAgentId,
  isCompact,
  onSelectArtifact,
  onSelectGeneration,
  onStopGeneration,
  onRetryGeneration,
}: Props) => (
  <ul className="flex flex-col gap-2">
    {generations.map((generation) => (
      <li key={generation.agentId}>
        <ArtifactGenerationRow
          generation={generation}
          isSelected={selectedGenerationAgentId === generation.agentId}
          hasScoutLines={!isCompact}
          onSelect={() => onSelectGeneration(generation)}
          onStop={() => onStopGeneration(generation)}
          onRetry={() => onRetryGeneration(generation)}
        />
      </li>
    ))}
    {artifacts.map((artifact) => (
      <li key={artifact.id}>
        <ArtifactRow
          artifact={artifact}
          isSelected={selectedArtifactId === artifact.id}
          onSelect={() => onSelectArtifact(artifact.id)}
        />
      </li>
    ))}
  </ul>
);
