import { LayoutTemplate } from 'lucide-react';
import { ActionTile, SplitButton, type OverflowMenuItem } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { CreateReportCta } from '../../../../reports/components/CreateReportCta';
import { CreateWireframeCta } from '../../../../wireframes/components/CreateWireframeCta';
import { reportCreationAdapter } from '../../../../reports/reportCreationAdapter';
import { wireframeCreationAdapter } from '../../../../wireframes/wireframeCreationAdapter';

type OverviewActionsVariant = 'compact' | 'tile';

type Props = {
  readonly sessionId: SessionId;
  readonly variant?: OverviewActionsVariant;
  readonly onOpenWorkflowBuilder: () => void;
};

const WORKFLOW_DESCRIPTION = 'Run a multi-step plan with checkpoints';

export const OverviewActions = ({
  sessionId,
  variant = 'compact',
  onOpenWorkflowBuilder,
}: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);

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
          title="Start a workflow"
          description={`${WORKFLOW_DESCRIPTION}.`}
          onClick={onOpenWorkflowBuilder}
        />
        <CreateReportCta sessionId={sessionId} variant="tile" />
        <CreateWireframeCta sessionId={sessionId} variant="tile" />
      </div>
    );
  }

  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'workflow',
      label: 'Workflow',
      description: WORKFLOW_DESCRIPTION,
      icon: CONCEPT_ICONS.workflows,
      tone: 'primary',
      onClick: onOpenWorkflowBuilder,
    },
    {
      kind: 'item',
      key: 'report',
      label: 'Report',
      description: reportCreationAdapter.ctaTitle,
      icon: CONCEPT_ICONS.changelog,
      tone: 'info',
      onClick: () => openArtifactCreation({ sessionId, kind: 'report', workflowRunId: null }),
    },
    {
      kind: 'item',
      key: 'wireframe',
      label: 'Wireframe',
      description: wireframeCreationAdapter.ctaTitle,
      icon: LayoutTemplate,
      tone: 'primary',
      onClick: () => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId: null }),
    },
  ];

  return (
    <SplitButton
      menuLabel="More ways to start"
      items={items}
      className="shrink-0"
      primary={({ className }) => (
        <CreateAgentPopover sessionId={sessionId} variant="compact" className={className} />
      )}
    />
  );
};
