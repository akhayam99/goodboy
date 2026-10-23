import { useEffect, useState } from 'react';
import { PaneShell } from '@goodboy/ui';
import { SessionDraftPane } from '../../../../../../features/session/components/SessionDraftPane';
import { SessionDraftActions } from '../../../../../../features/session/components/SessionDraftPane/SessionDraftActions';
import type { SessionDraft } from '../../../../../../store/slices/sessionDraft/state';
import { WORKSPACE_ID } from '../../BoardScene';
import { StudioFrame } from '../../StudioFrame';
import { StartPageBefore } from './StartPageBefore';
import { StartPageOneField } from './StartPageOneField';
import { START_PAGE_SEED } from './startPageSeedData';
import { seedStartPage } from './seedStartPage';

type StartPageEra =
  | { readonly kind: 'before-0-27-10' }
  | { readonly kind: 'before-0-27-11' }
  | { readonly kind: 'after'; readonly draft: Partial<SessionDraft> };

type Props = {
  readonly era: StartPageEra;
};

type DraftParams = {
  readonly era: StartPageEra;
};

const draftOf = ({ era }: DraftParams): Partial<SessionDraft> => {
  if (era.kind === 'after') {
    return { hasChosenStart: true, ...era.draft };
  }
  if (era.kind === 'before-0-27-11') {
    return { workflowGoal: START_PAGE_SEED.goal, projectIds: [START_PAGE_SEED.portalId] };
  }
  return { projectIds: [START_PAGE_SEED.portalId] };
};

export const StartPageScene = ({ era }: Props) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    seedStartPage({ draft: draftOf({ era }) });
    setIsReady(true);
  }, [era]);

  if (!isReady) {
    return null;
  }
  if (era.kind === 'after') {
    return (
      <StudioFrame
        target={{ place: null, tool: null }}
        main={<SessionDraftPane workspaceId={WORKSPACE_ID} />}
      />
    );
  }
  return (
    <StudioFrame
      target={{ place: null, tool: null }}
      main={
        <div className="@container relative flex h-full w-full min-w-0 flex-col">
          <PaneShell
            title="New session"
            actions={<SessionDraftActions workspaceId={WORKSPACE_ID} />}
            headerRhythm="section"
            width="measure"
          >
            {era.kind === 'before-0-27-10' ? (
              <StartPageBefore workspaceId={WORKSPACE_ID} />
            ) : (
              <StartPageOneField workspaceId={WORKSPACE_ID} />
            )}
          </PaneShell>
        </div>
      }
    />
  );
};
