import { useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionSlots,
  useSlotHistory,
  useSlotHistoryCount,
  useSummarizerStatus,
} from '../../../../store';
import type { LensKind } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { HeaderBand } from './HeaderBand';
import { GoalDetailAction } from './GoalDetailAction';
import { ArchivedGate } from './ArchivedGate';
import { goalPresence } from './goalPresence';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { SessionKickoff } from '../SessionKickoff';
import { IssueAdoptionProposal } from '../SessionKickoff/IssueAdoptionProposal';
import { hasNothingToAdopt, type IssueAdoption } from '../SessionKickoff/issueAdoption';
import { OverviewActions } from './OverviewActions';
import { InspectorSplit } from '../SessionWorkspace/parts/InspectorSplit';
import { SlotHistoryPanel } from '../SessionWorkspace/parts/SlotHistoryPanel';
import { GoalOverviewRegion } from './GoalOverviewRegion';
import { AttentionCallout } from './AttentionCallout';

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
  const renameTask = useAppStore((s) => s.renameTask);
  const reportError = useAppStore((s) => s.reportError);
  const [isGoalHistoryOpen, setIsGoalHistoryOpen] = useState(false);
  const [isGoalEditing, setIsGoalEditing] = useState(false);
  const [adoption, setAdoption] = useState<IssueAdoption | null>(null);
  const goalSlot = slots.find((slot) => slot.key === 'goal');

  const applyAdoptedTitle = () => {
    if (adoption?.title == null) {
      return;
    }
    const title = adoption.title;
    setAdoption({ ...adoption, title: null });
    renameTask(sessionId, title).catch((error: unknown) =>
      reportError({ title: "Couldn't rename the session", error, sessionId }),
    );
  };

  const applyAdoptedGoal = () => {
    if (adoption?.goal == null) {
      return;
    }
    const goal = adoption.goal;
    setAdoption({ ...adoption, goal: null });
    void upsertSessionSlot(sessionId, 'goal', goal);
  };

  const isGoalLoading = goalSlot == null && slotLoading.slots;
  const isArchived = session.archivedAt != null;
  const presence = goalPresence({ value: goalSlot?.value ?? '', sessionTitle: session.goal });

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
        header={
          <HeaderBand
            session={session}
            onSelectLens={onSelectLens}
            titleAction={
              presence === 'own' || isGoalEditing || isGoalLoading ? null : (
                <GoalDetailAction
                  presence={presence}
                  disabled={summarizer.status === 'running'}
                  onClick={() => setIsGoalEditing(true)}
                />
              )
            }
            goal={
              <GoalOverviewRegion
                sessionId={sessionId}
                sessionTitle={session.goal}
                value={goalSlot?.value ?? ''}
                historyCount={goalHistoryCount}
                isLoading={isGoalLoading}
                isSummarizing={summarizer.status === 'running'}
                isEditing={isGoalEditing}
                onEditingChange={setIsGoalEditing}
                onOpenHistory={() => {
                  void loadSlotHistory(sessionId, 'goal');
                  setIsGoalHistoryOpen(true);
                }}
              />
            }
          />
        }
        animationClassName="animate-fade-in"
      >
        <AttentionCallout session={session} onSelectLens={onSelectLens} />
        {adoption !== null && !hasNothingToAdopt({ adoption }) ? (
          <IssueAdoptionProposal
            adoption={adoption}
            onUseTitle={applyAdoptedTitle}
            onUseGoal={applyAdoptedGoal}
            onDismiss={() => setAdoption(null)}
          />
        ) : null}
        <TimelinePane
          session={session}
          actions={
            <ArchivedGate isArchived={isArchived}>
              <OverviewActions sessionId={sessionId} onOpenWorkflowBuilder={openWorkflowBuilder} />
            </ArchivedGate>
          }
          kickoff={
            <ArchivedGate isArchived={isArchived}>
              <SessionKickoff
                session={session}
                onOpenWorkflowBuilder={openWorkflowBuilder}
                onProposeAdoption={setAdoption}
              />
            </ArchivedGate>
          }
        />
      </PaneShell>
    </InspectorSplit>
  );
};
