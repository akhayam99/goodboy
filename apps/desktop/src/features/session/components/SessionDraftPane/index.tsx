import { Plus } from 'lucide-react';
import { PageColumn, Trail, PaneShell, UnderTrailContext } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { SessionKickoff } from '../SessionKickoff';
import { KeepDraftNotice } from './KeepDraftNotice';
import { SessionDraftHeader } from './SessionDraftHeader';
import { useSessionDraftClose } from './useSessionDraftClose';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const DRAFT_SEGMENTS = [{ id: 'new-session', label: 'New session', icon: Plus }];

export const SessionDraftPane = ({ workspaceId }: Props) => {
  const { isAsking, keepDraft, discardDraft } = useSessionDraftClose({ workspaceId });
  return (
    <div className="@container relative flex h-full w-full min-w-0 flex-col">
      <div data-slot="trail-bar" className="h-10 shrink-0 pb-1 pt-3">
        <PageColumn className="flex h-6 min-w-0 items-center">
          <Trail segments={DRAFT_SEGMENTS} />
        </PageColumn>
      </div>
      <UnderTrailContext.Provider value>
        <div className="relative min-h-0 flex-1">
          <PaneShell
            header={<SessionDraftHeader workspaceId={workspaceId} />}
            lead={isAsking ? <KeepDraftNotice onDiscard={discardDraft} onKeep={keepDraft} /> : null}
            animationClassName="animate-fade-in"
          >
            <SessionKickoff key={workspaceId} workspaceId={workspaceId} />
          </PaneShell>
        </div>
      </UnderTrailContext.Provider>
    </div>
  );
};
