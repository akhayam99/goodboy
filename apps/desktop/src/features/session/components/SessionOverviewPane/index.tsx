import { PaneShell } from '@goodboy/ui';
import { useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { HeaderBand } from './HeaderBand';
import { ArchivedGate } from './ArchivedGate';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { OverviewActions } from './OverviewActions';
import { ProjectMountRows } from './ProjectMountRows';
import { UnassignedNotes } from './UnassignedNotes';
import { NextStepSlot } from '../../../suggestions/components/NextStepSlot';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

const NO_SHOWN_QUESTIONS: ReadonlySet<string> = new Set();

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const isArchived = session.archivedAt != null;
  const [shownQuestionIds, setShownQuestionIds] = useState<ReadonlySet<string>>(NO_SHOWN_QUESTIONS);

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <PaneShell
      header={<HeaderBand session={session} onSelectLens={onSelectLens} />}
      headerRhythm="section"
      animationClassName="animate-fade-in"
    >
      <ProjectMountRows session={session} />
      <UnassignedNotes sessionId={sessionId} />
      <NextStepSlot
        session={session}
        onSelectLens={onSelectLens}
        shownQuestionIds={shownQuestionIds}
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
    </PaneShell>
  );
};
