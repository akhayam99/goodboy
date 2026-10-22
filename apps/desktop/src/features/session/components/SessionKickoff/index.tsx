import { useEffect, useRef, type ReactNode } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { draftIssueKey } from '../../../../store/slices/sessionDraft/draftIssueKey';
import { removeDraftIssue } from '../../../../store/slices/sessionDraft/removeDraftIssue';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import type { SessionDraftMount } from '../../../../store/slices/sessionDraft/startSessionFromDraft';
import { useLaunchMount } from '../../../inbox/useLaunchMount';
import { StartRun } from '../StartRun/StartRun';
import { KickoffProjects } from './KickoffProjects';
import { PickedIssueRow } from './PickedIssueRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly notice?: ReactNode;
};

export const SessionKickoff = ({ workspaceId, notice }: Props) => {
  const pickedIssues = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues,
  );
  const projectIds = useAppStore((state) => selectSessionDraft({ state, workspaceId }).projectIds);
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const [first] = pickedIssues;
  const launch = useLaunchMount({
    workspaceId,
    source:
      first === undefined
        ? null
        : { provider: first.provider, url: first.url, sentryProject: first.sentryProject ?? null },
  });
  const suggestedId = launch?.selectedId ?? null;
  const projectId = projectIds[0] ?? null;
  const mount: SessionDraftMount | null =
    launch === null || projectId === null || projectId !== suggestedId
      ? null
      : { projectId, reason: launch.reason };
  const prefilledRef = useRef<string | null>(null);

  useEffect(() => {
    if (suggestedId === null || prefilledRef.current === suggestedId) {
      return;
    }
    prefilledRef.current = suggestedId;
    if (projectIds.length === 0) {
      patchSessionDraft({ workspaceId, patch: { projectIds: [suggestedId] } });
    }
  }, [patchSessionDraft, projectIds.length, suggestedId, workspaceId]);

  return (
    <section aria-label="Kickoff" className="flex flex-col gap-6">
      <KickoffProjects
        workspaceId={workspaceId}
        suggestedIds={suggestedId === null ? [] : [suggestedId]}
        launch={mount}
      />
      {pickedIssues.length === 0 ? null : (
        <ul aria-label="Picked issues" className="flex flex-col">
          {pickedIssues.map((candidate, index) => {
            const key = draftIssueKey({ candidate });
            return (
              <PickedIssueRow
                key={key}
                candidate={candidate}
                isBranchNamer={index === 0 && pickedIssues.length > 1}
                onRemove={() =>
                  patchSessionDraft({
                    workspaceId,
                    patch: { pickedIssues: removeDraftIssue({ picked: pickedIssues, key }) },
                  })
                }
              />
            );
          })}
        </ul>
      )}
      <StartRun workspaceId={workspaceId} sessionId={null} mount={mount} />
      {notice === undefined || notice === null ? null : (
        <div data-slot="kickoff-notice">{notice}</div>
      )}
    </section>
  );
};
