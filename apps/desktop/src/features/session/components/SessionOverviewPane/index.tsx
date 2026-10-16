import { PaneShell } from '@goodboy/ui';
import { useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { NAMES } from '../../../../shared/names';
import { HeaderBand } from './HeaderBand';
import { OverviewHeaderActions } from './OverviewHeaderActions';
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

  return (
    <PaneShell
      title={NAMES.overview}
      actions={<OverviewHeaderActions session={session} />}
      headerRhythm="section"
      animationClassName="animate-fade-in"
    >
      <HeaderBand session={session} />
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
            <OverviewActions session={session} />
          </ArchivedGate>
        }
      />
    </PaneShell>
  );
};
