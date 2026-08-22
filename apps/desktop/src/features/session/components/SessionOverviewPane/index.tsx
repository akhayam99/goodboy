import { useMemo, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useSessionStageInfo,
  useSessionLoading,
  useSessionSlots,
  useSlotHistory,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { useWorkspaceRuns } from '../../../orchestration/hooks/useWorkspaceRuns';
import { selectStandaloneAgents } from '../../agent-kind';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { HeaderBand } from './HeaderBand';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { OverviewActions } from './OverviewActions';
import { InspectorSplit } from '../SessionWorkspace/parts/InspectorSplit';
import { SlotHistoryPanel } from '../SessionWorkspace/parts/SlotHistoryPanel';
import { GoalOverviewRegion } from './GoalOverviewRegion';
import { OverviewNextSteps } from './OverviewNextSteps';
import { OverviewPlans } from './OverviewPlans';
import { OverviewPrs } from './OverviewPrs';
import { OverviewWorkflows } from './OverviewWorkflows';
import { IntentComposer } from './IntentComposer';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const slots = useSessionSlots(sessionId);
  const slotLoading = useSessionLoading(sessionId);
  const goalHistory = useSlotHistory(sessionId, 'goal');
  const goalHistoryCount = useSlotHistoryCount(sessionId, 'goal');
  const summarizer = useSummarizerStatus(sessionId);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const upsertSessionSlot = useAppStore((s) => s.upsertSessionSlot);
  const [isGoalHistoryOpen, setIsGoalHistoryOpen] = useState(false);
  const goalSlot = slots.find((slot) => slot.key === 'goal');
  const stage = useSessionStageInfo(session);
  const sessionList = useMemo(() => [session], [session]);
  const runs = useWorkspaceRuns(session.workspaceId, sessionList);
  const sessionAgents = useAppStore((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const rawStandalone = selectStandaloneAgents(sessionAgents);

  const activeRuns = useMemo(
    () => session.workflowRuns.filter((run) => run.discardedAt == null),
    [session.workflowRuns],
  );
  const isFresh = activeRuns.length === 0 && rawStandalone.length === 0;

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <InspectorSplit
      open={isGoalHistoryOpen}
      panel={
        isGoalHistoryOpen ? (
          <SlotHistoryPanel
            label="Goal"
            renderAsMarkdown={false}
            entries={goalHistory}
            onRestore={(entry) => {
              void upsertSessionSlot(sessionId, 'goal', entry.value);
              setIsGoalHistoryOpen(false);
            }}
            onClose={() => setIsGoalHistoryOpen(false)}
          />
        ) : null
      }
    >
      <PaneShell
        header={<HeaderBand session={session} stage={stage} onSelectLens={onSelectLens} />}
        animationClassName="animate-fade-in"
      >
        {isFresh ? (
          <>
            <IntentComposer sessionId={sessionId} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openWorkflowBuilder}
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Attach a workflow instead
              </button>
            </div>
          </>
        ) : (
          <>
            <GoalOverviewRegion
              sessionId={sessionId}
              value={goalSlot?.value ?? ''}
              historyCount={goalHistoryCount}
              isLoading={goalSlot == null && slotLoading.slots}
              isSummarizing={summarizer.status === 'running'}
              onOpenHistory={() => {
                void loadSlotHistory(sessionId, 'goal');
                setIsGoalHistoryOpen(true);
              }}
            />
            <OverviewNextSteps session={session} agents={sessionAgents} />
            <OverviewPlans session={session} onSelectLens={onSelectLens} />
            <OverviewWorkflows session={session} onSelectLens={onSelectLens} />
            <OverviewPrs session={session} onSelectLens={onSelectLens} />
            <TimelinePane
              session={session}
              runs={runs}
              actions={
                <OverviewActions
                  sessionId={sessionId}
                  onOpenWorkflowBuilder={openWorkflowBuilder}
                />
              }
            />
          </>
        )}
      </PaneShell>
    </InspectorSplit>
  );
};
