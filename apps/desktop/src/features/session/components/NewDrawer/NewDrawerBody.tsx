import { useEffect, useState, type ComponentType } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button, DrawerFrame, SegmentedTabs, type SegmentedTabOption } from '@goodboy/ui';
import type { AgentId, Session } from '@goodboy/types';
import { EMPTY_ARRAY, sessionPlace, useAppStore } from '../../../../store';
import type {
  NewDrawerPayload,
  NewDrawerTab,
  NewDrawerWriteKind,
} from '../../../../store/slices/drawer/state';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { AGENT_LINE, AUTO_AGENT_LINE, RUN_LINE } from '../../../../shared/lib/startCopy';
import { WorkflowBuilderView } from '../../../workflows/components/WorkflowBuilderView';
import { hasActiveWorkflowRun } from '../../../workflows/activeWorkflowRuns';
import { useNewDrawerTab } from '../../hooks/useNewDrawerTab';
import { AgentPanel } from './AgentPanel';
import type { WritePanelProps } from '../../../artifacts/writePanelProps';

type Props = {
  readonly session: Session;
  readonly payload: NewDrawerPayload | null;
  readonly isAuto: boolean;
  readonly writePanel: ComponentType<WritePanelProps>;
  readonly onClose: () => void;
};

const TAB_OPTIONS: ReadonlyArray<SegmentedTabOption<NewDrawerTab>> = [
  { value: 'run', label: 'Run', icon: CONCEPT_ICONS.workflows },
  { value: 'agent', label: 'Agent', icon: CONCEPT_ICONS.agents },
  { value: 'write', label: 'Write', icon: CONCEPT_ICONS.report },
];

const WRITE_LINE = 'A report or a wireframe, written from this session.';

type LineParams = {
  readonly tab: NewDrawerTab;
  readonly isAuto: boolean;
};

const lineOf = ({ tab, isAuto }: LineParams): string => {
  if (tab === 'run') {
    return RUN_LINE;
  }
  if (tab === 'agent') {
    return isAuto ? AUTO_AGENT_LINE : AGENT_LINE;
  }
  return WRITE_LINE;
};

export const NewDrawerBody = ({
  session,
  payload,
  isAuto,
  writePanel: WritePanel,
  onClose,
}: Props) => {
  const sessionId = session.id;
  const requestedTab = payload?.tab ?? null;
  const { tab, choose } = useNewDrawerTab({
    workspaceId: session.workspaceId,
    requested: requestedTab,
  });
  const [writeKind, setWriteKind] = useState<NewDrawerWriteKind>(payload?.writeKind ?? 'report');
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
  const [action, setAction] = useState<HTMLElement | null>(null);
  const agents = useAppStore(
    useShallow((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY),
  );
  const isRunActive = hasActiveWorkflowRun({ workflowRuns: session.workflowRuns, agents });

  useEffect(() => {
    if (payload === null) {
      return;
    }
    choose({ tab: payload.tab });
    if (payload.writeKind !== undefined) {
      setWriteKind(payload.writeKind);
    }
  }, [payload, choose]);

  useEffect(() => {
    if (tab === 'run') {
      document.getElementById('workflow-goal')?.focus({ preventScroll: true });
    }
  }, [tab]);

  const openRun = (): void => {
    onClose();
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId, lens: 'workflows' }) });
  };

  const onStarted = (agentId: AgentId): void => {
    const state = useAppStore.getState();
    state.awaitArtifactAgent({ sessionId, agentId });
    state.navigate({ to: sessionPlace({ sessionId, lens: 'plans' }) });
  };

  return (
    <DrawerFrame
      title="New"
      icon={Plus}
      onClose={onClose}
      action={<span ref={setAction} className="contents" />}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <SegmentedTabs
          fill
          ariaLabel="What to start"
          value={tab}
          options={TAB_OPTIONS}
          onChange={(next) => choose({ tab: next })}
        />
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 text-label text-muted-foreground">{lineOf({ tab, isAuto })}</p>
          {tab === 'run' && isRunActive ? (
            <Button variant="ghost" size="sm" onClick={openRun}>
              <ArrowRight size={ICON_SIZE.control} aria-hidden />
              Open active run
            </Button>
          ) : null}
        </div>
        <div role="tabpanel" aria-label={tab} className="flex min-w-0 flex-col gap-6">
          {tab === 'run' ? (
            <WorkflowBuilderView
              session={session}
              slots={{ actionsHost, action }}
              onClose={onClose}
            />
          ) : null}
          {tab === 'agent' ? (
            <AgentPanel
              sessionId={sessionId}
              isAuto={isAuto}
              actionsHost={actionsHost}
              action={action}
              onClose={onClose}
            />
          ) : null}
          {tab === 'write' ? (
            <WritePanel
              session={session}
              kind={writeKind}
              note={payload?.note ?? null}
              actionsHost={actionsHost}
              onKind={setWriteKind}
              onStarted={onStarted}
              onClose={onClose}
            />
          ) : null}
        </div>
        <div ref={setActionsHost} className="sticky bottom-0 z-10 flex flex-col bg-subtle pb-4" />
      </div>
    </DrawerFrame>
  );
};
