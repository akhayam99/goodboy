import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PageColumn, Trail } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { UnderTrailContext } from '../../../../shared/components/PaneShell/underTrailContext';
import { SessionKickoff } from '../SessionKickoff';
import { SessionDraftHeader } from './SessionDraftHeader';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const DRAFT_SEGMENTS = [{ id: 'new-session', label: 'New session', icon: Plus }];

export const SessionDraftPane = ({ workspaceId }: Props) => {
  const [discards, setDiscards] = useState(0);
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
              <SessionDraftHeader
                workspaceId={workspaceId}
                onDiscarded={() => setDiscards((count) => count + 1)}
              />
            }
            animationClassName="animate-fade-in"
          >
            <SessionKickoff key={`${workspaceId}:${discards}`} workspaceId={workspaceId} />
          </PaneShell>
        </div>
      </UnderTrailContext.Provider>
    </div>
  );
};
