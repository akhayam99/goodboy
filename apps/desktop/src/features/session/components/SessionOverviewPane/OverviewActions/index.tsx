import { ChevronDown, LayoutTemplate, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import {
  AnchoredPopover,
  Button,
  MenuItems,
  useDropdown,
  type OverflowMenuItem,
} from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
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

type EventParams = {
  readonly sessionId: SessionId;
};

const startAgentEventOf = ({ sessionId }: EventParams): string =>
  `goodboy:overview-start-agent:${sessionId}`;

export const OverviewActions = ({ session, onOpenWorkflowBuilder, onOpenRun }: Props) => {
  const sessionId = session.id;
  const openArtifactCreation = useAppStore((state) => state.openArtifactCreation);
  const agents = useAppStore(
    useShallow((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const isRunActive = hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents });
  const dropdown = useDropdown({
    align: 'end',
    width: 'min-w-[200px]',
    expectedHeight: 200,
  });
  const startAgentEvent = startAgentEventOf({ sessionId });

  const items: ReadonlyArray<OverflowMenuItem> = [
    {
      kind: 'item',
      key: 'workflow',
      label: isRunActive ? 'Open run' : 'Start a run',
      icon: CONCEPT_ICONS.workflows,
      onClick: isRunActive ? onOpenRun : onOpenWorkflowBuilder,
    },
    {
      kind: 'item',
      key: 'agent',
      label: 'Start agent',
      icon: CONCEPT_ICONS.agents,
      onClick: () => window.dispatchEvent(new CustomEvent(startAgentEvent)),
    },
    { kind: 'separator', key: 'artifacts' },
    {
      kind: 'item',
      key: 'report',
      label: 'Report',
      description: reportCreationAdapter.ctaTitle,
      icon: CONCEPT_ICONS.changelog,
      onClick: () => openArtifactCreation({ sessionId, kind: 'report', workflowRunId: null }),
    },
    {
      kind: 'item',
      key: 'wireframe',
      label: 'Wireframe',
      description: wireframeCreationAdapter.ctaTitle,
      icon: LayoutTemplate,
      onClick: () => openArtifactCreation({ sessionId, kind: 'wireframe', workflowRunId: null }),
    },
  ];

  const menu = (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="New"
      className="py-1"
      trigger={
        <Button
          variant="secondary"
          size="sm"
          onClick={dropdown.toggle}
          aria-haspopup="menu"
          aria-expanded={dropdown.open}
        >
          <Plus size={ICON_SIZE.control} aria-hidden className="shrink-0" />
          New
          <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
        </Button>
      }
    >
      <MenuItems items={items} onClose={dropdown.close} />
    </AnchoredPopover>
  );

  return <CreateAgentPopover sessionId={sessionId} openEvent={startAgentEvent} anchor={menu} />;
};
