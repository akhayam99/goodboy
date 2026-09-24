import { ActionTile, Button } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { CreateReportCta } from '../../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../../wireframes/components/CreateWireframeCta';

type OverviewActionsVariant = 'compact' | 'tile';

type Props = {
  readonly sessionId: SessionId;
  readonly variant?: OverviewActionsVariant;
  readonly onOpenWorkflowBuilder: () => void;
};

const WORKFLOW_TILE_DESCRIPTION = 'Run a multi-step plan with checkpoints.';

export const OverviewActions = ({
  sessionId,
  variant = 'compact',
  onOpenWorkflowBuilder,
}: Props) => {
  if (variant === 'tile') {
    return (
      <div className="grid gap-2 lg:grid-cols-2">
        <CreateAgentPopover
          sessionId={sessionId}
          variant="tile"
          description="Brief a specialist and let it run."
        />
        <ActionTile
          icon={
            <CONCEPT_ICONS.workflows size={ICON_SIZE.hero} aria-hidden className="text-primary" />
          }
          title="Add workflow"
          description={WORKFLOW_TILE_DESCRIPTION}
          onClick={onOpenWorkflowBuilder}
        />
        <CreateReportCta sessionId={sessionId} variant="tile" />
        <CreateWireframeCta sessionId={sessionId} variant="tile" />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <Button variant="secondary" size="sm" onClick={onOpenWorkflowBuilder}>
        <CONCEPT_ICONS.workflows size={ICON_SIZE.row} aria-hidden />
        Add workflow
      </Button>
      <CreateReportCta sessionId={sessionId} />
      <CreateWireframeCta sessionId={sessionId} />
      <CreateAgentPopover sessionId={sessionId} variant="compact" />
    </div>
  );
};
