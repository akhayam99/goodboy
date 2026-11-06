import { Button, ICON_SIZE } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../../../store';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
};

const AgentIcon = CONCEPT_ICONS.agents;

export const ArtifactFollowButton = ({ sessionId, agentId }: Props) => {
  const navigate = useAppStore((state) => state.navigate);

  return (
    <Button
      variant="secondary"
      size="sm"
      title="Open the agent writing it"
      onClick={() => navigate({ to: agentPlace({ sessionId, agentId }) })}
      data-testid="artifact-follow"
    >
      <AgentIcon size={ICON_SIZE.row} aria-hidden />
      Follow
    </Button>
  );
};
