import { useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import {
  useAppStore,
  useSessionLoading,
  useSessionSlots,
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
import { IssueBriefProposal } from '../SessionKickoff/IssueBriefProposal';
import { useIssueBriefProposal } from './useIssueBriefProposal';
import { OverviewActions } from './OverviewActions';
import { GoalOverviewRegion } from './GoalOverviewRegion';
import { AttentionCallout } from './AttentionCallout';
import { NextStepSlot } from '../../../suggestions/components/NextStepSlot';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const slots = useSessionSlots(sessionId);
  const slotLoading = useSessionLoading(sessionId);
  const goalHistoryCount = useSlotHistoryCount(sessionId, 'goal');
  const summarizer = useSummarizerStatus(sessionId);
  const loadSlotHistory = useAppStore((s) => s.loadSlotHistory);
  const toggleDrawer = useAppStore((s) => s.toggleDrawer);
  const [isGoalEditing, setIsGoalEditing] = useState(false);
  const [isKickoffShown, setIsKickoffShown] = useState(false);
  const { proposal, pickIssue } = useIssueBriefProposal({ session });
  const goalSlot = slots.find((slot) => slot.key === 'goal');

  const isGoalLoading = goalSlot == null && slotLoading.slots;
  const isArchived = session.archivedAt != null;
  const presence = goalPresence({ value: goalSlot?.value ?? '', sessionTitle: session.goal });

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <PaneShell
      header={
        <HeaderBand
          session={session}
          onSelectLens={onSelectLens}
          isEmpty={isKickoffShown}
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
                toggleDrawer({ kind: 'slot-history', sessionId, payload: { slotKey: 'goal' } });
              }}
            />
          }
        />
      }
      animationClassName="animate-fade-in"
    >
      <AttentionCallout session={session} onSelectLens={onSelectLens} />
      {proposal !== null ? (
        <IssueBriefProposal key={proposal.source.externalId} {...proposal} />
      ) : null}
      {isKickoffShown ? null : <NextStepSlot session={session} />}
      <TimelinePane
        session={session}
        actions={
          <ArchivedGate isArchived={isArchived}>
            <OverviewActions sessionId={sessionId} onOpenWorkflowBuilder={openWorkflowBuilder} />
          </ArchivedGate>
        }
        kickoff={
          isArchived ? undefined : (
            <SessionKickoff
              session={session}
              onOpenWorkflowBuilder={openWorkflowBuilder}
              onPickIssue={pickIssue}
            />
          )
        }
        onKickoffShownChange={setIsKickoffShown}
      />
    </PaneShell>
  );
};
