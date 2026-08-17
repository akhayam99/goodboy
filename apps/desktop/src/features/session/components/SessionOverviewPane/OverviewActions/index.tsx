import { Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { CreateAgentPopover } from '../../CreateAgentPopover';

type Props = {
  readonly sessionId: SessionId;
  readonly onOpenWorkflowBuilder: () => void;
};

export const OverviewActions = ({ sessionId, onOpenWorkflowBuilder }: Props) => (
  <div className="flex shrink-0 flex-wrap items-center gap-2">
    <Button variant="ghost" size="sm" onClick={onOpenWorkflowBuilder}>
      <CONCEPT_ICONS.workflows size={13} aria-hidden />
      New workflow
    </Button>
    <CreateAgentPopover sessionId={sessionId} variant="compact" />
  </div>
);
