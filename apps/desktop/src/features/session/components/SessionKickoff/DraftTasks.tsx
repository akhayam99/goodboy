import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { draftIssueKey } from '../../../../store/slices/sessionDraft/draftIssueKey';
import { removeDraftIssue } from '../../../../store/slices/sessionDraft/removeDraftIssue';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { PickedIssueRow } from './PickedIssueRow';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const DraftTasks = ({ workspaceId }: Props) => {
  const pickedIssues = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues,
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  if (pickedIssues.length === 0) {
    return null;
  }
  return (
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
  );
};
