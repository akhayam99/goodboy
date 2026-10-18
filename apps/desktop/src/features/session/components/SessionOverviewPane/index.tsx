import { PaneShell } from '@goodboy/ui';
import { useCallback, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { FolderCard } from './FolderCard';
import { HeaderBand } from './HeaderBand';
import { OverviewTitle } from './OverviewTitle';
import { OverviewHeaderActions } from './OverviewHeaderActions';
import { OverviewNotices } from './OverviewNotices';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { UnassignedNotes } from './UnassignedNotes';
import { NextStepSlot } from '../../../suggestions/components/NextStepSlot';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

type LeadChange = {
  readonly hasLead: boolean;
};

const NO_SHOWN_QUESTIONS: ReadonlySet<string> = new Set();

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const [shownQuestionIds, setShownQuestionIds] = useState<ReadonlySet<string>>(NO_SHOWN_QUESTIONS);
  const [hasNextLead, setHasNextLead] = useState(false);
  const onLeadChange = useCallback(({ hasLead }: LeadChange) => setHasNextLead(hasLead), []);
  const isArchived = session.archivedAt != null;

  return (
    <PaneShell
      page="overview"
      title={<OverviewTitle session={session} />}
      actions={<OverviewHeaderActions session={session} hasNextLead={hasNextLead} />}
      headerRhythm="section"
      animationClassName="animate-fade-in"
    >
      <HeaderBand session={session} />
      {isArchived ? null : <OverviewNotices session={session} />}
      {isArchived ? null : <UnassignedNotes sessionId={sessionId} />}
      {isArchived ? null : <FolderCard sessionId={sessionId} />}
      <TimelinePane
        session={session}
        onShownQuestionsChange={setShownQuestionIds}
        lead={
          isArchived ? null : (
            <NextStepSlot
              session={session}
              onSelectLens={onSelectLens}
              shownQuestionIds={shownQuestionIds}
              onLeadChange={onLeadChange}
            />
          )
        }
      />
    </PaneShell>
  );
};
