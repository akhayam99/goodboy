import type { Session, SessionId } from '@goodboy/types';
import type { LensKind } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { HeaderBand } from './HeaderBand';
import { ArchivedGate } from './ArchivedGate';
import { TimelinePane } from '../SessionWorkspace/parts/TimelinePane';
import { OverviewActions } from './OverviewActions';
import { AttentionCallout } from './AttentionCallout';

type Props = {
  readonly session: Session;
  readonly onSelectLens: (lens: LensKind) => void;
};

export const SessionOverviewPane = ({ session, onSelectLens }: Props) => {
  const sessionId: SessionId = session.id;
  const isArchived = session.archivedAt != null;

  const openWorkflowBuilder = () => {
    window.dispatchEvent(
      new CustomEvent('goodboy:open-workflow-builder', { detail: { sessionId } }),
    );
  };

  return (
    <PaneShell
      header={<HeaderBand session={session} onSelectLens={onSelectLens} />}
      animationClassName="animate-fade-in"
    >
      <AttentionCallout session={session} onSelectLens={onSelectLens} />
      <TimelinePane
        session={session}
        actions={
          <ArchivedGate isArchived={isArchived}>
            <OverviewActions sessionId={sessionId} onOpenWorkflowBuilder={openWorkflowBuilder} />
          </ArchivedGate>
        }
      />
    </PaneShell>
  );
};
