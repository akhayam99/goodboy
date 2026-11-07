import type { Session } from '@goodboy/types';

import { openAgentRevealEvent } from '../../../../../shared/utils/openAgentReveal';
import { useAppStore } from '../../../../../store';
import { StartAnywayButton } from '../../../../workflows/components/StartAnywayButton';
import type { RunView } from '../useRunView';
import type { RunPrimaryVariant } from './RunPrimaryAction';

type Props = {
  readonly session: Session;
  readonly view: RunView;
  readonly label: string;
  readonly variant: RunPrimaryVariant;
};

export const StartStepPrimary = ({ session, view, label, variant }: Props) => {
  const activateWorkflowAgent = useAppStore((state) => state.activateWorkflowAgent);
  const agent = view.nextStepAgent;

  return (
    <StartAnywayButton
      label={label}
      variant={variant}
      blockReason={view.blockReason}
      onStart={async ({ isConfirmed }) => {
        if (agent === null) {
          return;
        }
        window.dispatchEvent(openAgentRevealEvent());
        await activateWorkflowAgent({
          sessionId: session.id,
          agentId: agent.id,
          focus: 'agent',
          bypassGate: isConfirmed,
        });
      }}
    />
  );
};
