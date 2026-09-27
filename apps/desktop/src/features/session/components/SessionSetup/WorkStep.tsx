import { OverflowMenu } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { CreateAgentPopover } from '../CreateAgentPopover';
import { useArtifactCreateItems } from '../SessionOverviewPane/OverviewActions/useArtifactCreateItems';
import { SetupStepActions } from './SetupStepActions';
import { WorkflowPicker } from './WorkflowPicker';

type Props = {
  readonly session: Session;
};

export const WorkStep = ({ session }: Props) => {
  const createItems = useArtifactCreateItems({ sessionId: session.id });

  return (
    <div className="flex flex-col gap-3">
      <WorkflowPicker session={session} />
      <SetupStepActions note="Or start one agent and work with it directly.">
        <OverflowMenu label="Create" items={createItems} />
        <CreateAgentPopover sessionId={session.id} />
      </SetupStepActions>
    </div>
  );
};
