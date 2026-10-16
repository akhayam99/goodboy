import { PaneShell } from '@goodboy/ui';
import { useCallback, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { NAMES } from '../../../../shared/names';
import { HeaderBand } from './HeaderBand';
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

  return (
    <PaneShell
      title={NAMES.overview}
      actions={<OverviewHeaderActions session={session} hasNextLead={hasNextLead} />}
      headerRhythm="section"
      animationClassName="animate-fade-in"
    >
      <HeaderBand session={session} />
      <OverviewNotices session={session} />
      <UnassignedNotes sessionId={sessionId} />
      <TimelinePane
        session={session}
        onShownQuestionsChange={setShownQuestionIds}
        lead={
          <NextStepSlot
            session={session}
            onSelectLens={onSelectLens}
            shownQuestionIds={shownQuestionIds}
            onLeadChange={onLeadChange}
          />
        }
      />
    </PaneShell>
  );
};
