import { useMemo, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { HeaderBand } from './HeaderBand';
import { ArchivedGate } from './ArchivedGate';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { OverviewActions } from './OverviewActions';
import { AttentionCallout } from './AttentionCallout';
import { useAttentionTarget } from './useAttentionTarget';
import { isAttentionCalloutShown } from './lib';
import { NextStepSlot } from '../../../suggestions/components/NextStepSlot';
import { SessionSetup } from '../SessionSetup';
import { useSessionSetup } from '../SessionSetup/useSessionSetup';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

const NO_SHOWN_QUESTIONS: ReadonlySet<string> = new Set();

const NO_AGENTS: ReadonlySet<string> = new Set();

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const isArchived = session.archivedAt != null;
  const setup = useSessionSetup({ session });
  const [shownQuestionIds, setShownQuestionIds] = useState<ReadonlySet<string>>(NO_SHOWN_QUESTIONS);
  const attention = useAttentionTarget({ session });
  const isQuestionShownBelow = !setup.isActive;
  const calloutAgentId =
    attention.target?.kind === 'agent' &&
    isAttentionCalloutShown({ attention, isQuestionShownBelow })
      ? attention.target.agentId
      : null;
  const shownApprovalAgentIds = useMemo(
    () => (calloutAgentId === null ? NO_AGENTS : new Set<string>([calloutAgentId])),
    [calloutAgentId],
  );

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <PaneShell
      header={
        <HeaderBand session={session} isSettingUp={setup.isActive} onSelectLens={onSelectLens} />
      }
      animationClassName="animate-fade-in"
    >
      <AttentionCallout
        sessionId={sessionId}
        attention={attention}
        onSelectLens={onSelectLens}
        isQuestionShownBelow={isQuestionShownBelow}
      />
      {setup.isActive ? (
        <SessionSetup session={session} steps={setup.steps} />
      ) : (
        <>
          <NextStepSlot
            session={session}
            onSelectLens={onSelectLens}
            shownQuestionIds={shownQuestionIds}
            shownAgentIds={shownApprovalAgentIds}
          />
          <TimelinePane
            session={session}
            onShownQuestionsChange={setShownQuestionIds}
            actions={
              <ArchivedGate isArchived={isArchived}>
                <OverviewActions
                  session={session}
                  onOpenWorkflowBuilder={openWorkflowBuilder}
                  onOpenRun={() => onSelectLens('workflows')}
                />
              </ArchivedGate>
            }
          />
        </>
      )}
    </PaneShell>
  );
};
