import { useShallow } from 'zustand/react/shallow';
import { Button, OverflowMenu, tintClasses } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { hasActiveWorkflowRun } from '../../../../workflows/activeWorkflowRuns';
import { CreateAgentPopover } from '../../CreateAgentPopover';
import { useArtifactCreateItems } from './useArtifactCreateItems';

type Props = {
  readonly session: Session;
  readonly onOpenWorkflowBuilder: () => void;
  readonly onOpenRun: () => void;
};

export const OverviewActions = ({ session, onOpenWorkflowBuilder, onOpenRun }: Props) => {
  const sessionId = session.id;
  const agents = useAppStore(
    useShallow((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const isRunActive = hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents });
  const createItems = useArtifactCreateItems({ sessionId });

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
