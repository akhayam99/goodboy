import { LayoutTemplate } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, OverflowMenu, tintClasses, type OverflowMenuItem } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { hasActiveWorkflowRun } from '../../../../workflows/activeWorkflowRuns';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { reportCreationAdapter } from '../../../../reports/reportCreationAdapter';
import { wireframeCreationAdapter } from '../../../../wireframes/wireframeCreationAdapter';

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
  readonly onOpenRun: () => void;
};

export const OverviewActions = ({ session, onOpenWorkflowBuilder, onOpenRun }: Props) => {
  const sessionId = session.id;
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const agents = useAppStore(
    useShallow((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const isRunActive = hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents });

  const createItems: ReadonlyArray<OverflowMenuItem> = [
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
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        onClick={isRunActive ? onOpenRun : onOpenWorkflowBuilder}
      >
        <CONCEPT_ICONS.workflows
          size={ICON_SIZE.control}
          aria-hidden
          className={tintClasses('primary').icon}
        />
        {isRunActive ? 'Open run' : 'Run workflow'}
      </Button>
      <CreateAgentPopover sessionId={sessionId} />
      <OverflowMenu label="Create" items={createItems} />
    </div>
  );
};
