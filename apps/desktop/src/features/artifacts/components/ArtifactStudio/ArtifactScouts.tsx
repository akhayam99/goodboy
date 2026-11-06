import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { ArtifactScoutList } from './ArtifactScoutList';
import { useArtifactScoutRoster } from '../../useArtifactScoutRoster';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly emptyLine: string;
};

export const ArtifactScouts = ({ sessionId, agentId, emptyLine }: Props) => {
  const { rows, isLoaded } = useArtifactScoutRoster({ sessionId, agentId });
  const navigate = useAppStore((state) => state.navigate);

  if (!isLoaded && rows.length === 0) {
    return null;
  }

  return (
    <ArtifactScoutList
      rows={rows}
      emptyLine={emptyLine}
      onOpen={({ agentId: scoutId }) =>
        navigate({ to: agentPlace({ sessionId, agentId: scoutId }) })
      }
    />
  );
};
