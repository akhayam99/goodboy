import { isAgentStatusHalted } from '@goodboy/core/workflows';
import { Button } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { openAgentRevealEvent } from '../../../../../shared/utils/openAgentReveal';
import { agentPlace, useAppStore } from '../../../../../store';
import type { RunView } from '../useRunView';
import type { RunPrimaryVariant } from './RunPrimaryAction';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly label: string;
  readonly variant: RunPrimaryVariant;
};

export const OpenStepPrimary = ({ session, view, label, variant }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const halted = [...view.agents]
    .sort((left, right) => left.ordinal - right.ordinal)
    .find((agent) => isAgentStatusHalted({ status: agent.status }));
  if (halted === undefined) {
    return null;
  }
  return (
    <Button
      size="sm"
      variant={variant}
      onClick={() => {
        navigate({ to: agentPlace({ sessionId: session.id, agentId: halted.id }) });
        window.dispatchEvent(openAgentRevealEvent());
      }}
    >
      {label}
    </Button>
  );
};
