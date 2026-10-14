import { Plus } from 'lucide-react';
import { PageColumn, Trail, PaneShell, PaneTitleRow, UnderTrailContext } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { SessionKickoff } from '../SessionKickoff';
import { KeepDraftNotice } from './KeepDraftNotice';
import { useSessionDraftClose } from './useSessionDraftClose';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isAuto?: boolean;
};

const DRAFT_SEGMENTS = [{ id: 'new-session', label: 'New session', icon: Plus }];

export const SessionDraftPane = ({ workspaceId, isAuto }: Props) => {
  const { isAsking, keepDraft } = useSessionDraftClose({ workspaceId });
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
            header={
              <div className="sr-only">
                <PaneTitleRow title="New session" />
              </div>
            }
            animationClassName="animate-fade-in"
          >
            <SessionKickoff
              key={workspaceId}
              workspaceId={workspaceId}
              notice={isAsking ? <KeepDraftNotice onKeep={keepDraft} /> : null}
              {...(isAuto !== undefined && { isAuto })}
            />
          </PaneShell>
        </div>
      </UnderTrailContext.Provider>
    </div>
  );
};
