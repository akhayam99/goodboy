import type { AgentId, SessionId } from '@goodboy/types';
import { ArtifactScoutList } from './ArtifactScoutList';
import { useArtifactScoutRoster } from '../../useArtifactScoutRoster';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly emptyLine: string;
};

export const ArtifactScouts = ({ sessionId, agentId, emptyLine }: Props) => {
  const { rows, isLoaded } = useArtifactScoutRoster({ sessionId, agentId });

  if (!isLoaded && rows.length === 0) {
    return null;
  }

  return <ArtifactScoutList rows={rows} emptyLine={emptyLine} />;
};
