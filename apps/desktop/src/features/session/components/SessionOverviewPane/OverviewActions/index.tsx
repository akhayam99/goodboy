import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { CreateAgentPopover } from '../../CreateAgentPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly onOpenWorkflowBuilder: () => void;
  readonly showNewWorkflow?: boolean;
  readonly showCreateAgent?: boolean;
};

export const OverviewActions = ({
  sessionId,
  onOpenWorkflowBuilder,
  showNewWorkflow = true,
  showCreateAgent = true,
}: Props) => {
  if (!showNewWorkflow && !showCreateAgent) {
    return null;
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {showNewWorkflow ? (
        <Button variant="ghost" size="sm" onClick={onOpenWorkflowBuilder}>
          <CONCEPT_ICONS.workflows size={13} aria-hidden />
          New workflow
        </Button>
      ) : null}
      {showCreateAgent ? <CreateAgentPopover sessionId={sessionId} variant="compact" /> : null}
    </div>
  );
};
