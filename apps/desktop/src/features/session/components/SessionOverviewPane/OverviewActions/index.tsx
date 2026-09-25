import { LayoutTemplate } from 'lucide-react';
import { SplitButton, type OverflowMenuItem } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { CONCEPT_ICONS } from '../../../../../shared/components/conceptIcons';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { reportCreationAdapter } from '../../../../reports/reportCreationAdapter';
import { wireframeCreationAdapter } from '../../../../wireframes/wireframeCreationAdapter';

type Props = {
  readonly sessionId: SessionId;
  readonly onOpenWorkflowBuilder: () => void;
};

const WORKFLOW_DESCRIPTION = 'Run a multi-step plan with checkpoints';

export const OverviewActions = ({ sessionId, onOpenWorkflowBuilder }: Props) => {
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);

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
        <CreateAgentPopover sessionId={sessionId} className={className} />
      )}
    />
  );
};
