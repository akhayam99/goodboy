import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { useInboxRecords } from '../../../inbox/useInboxRecords';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import { primaryProjectRoot } from '../../../workspace/primaryProjectRoot';
import { issueGoalOf } from '../../issueGoalOf';
import { TaskPickerPopover } from './TaskPickerPopover';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
};

type AttachParams = {
  readonly candidate: IssueCandidate;
};

export const TaskPicker = ({ workspaceId, isDisabled }: Props) => {
  const rootPath = useAppStore((state) =>
    primaryProjectRoot({ projects: state.projects, workspaceId }),
  );
  const inbox = useInboxRecords({ workspaceId, rootPath: rootPath ?? '' });
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);

  const attach = ({ candidate }: AttachParams): void => {
    const draft = selectSessionDraft({ state: useAppStore.getState(), workspaceId });
    patchSessionDraft({
      workspaceId,
      patch: {
        pickedIssues: [candidate],
        ...(draft.workflowGoal.trim() === '' && {
          workflowGoal: issueGoalOf({ candidate }),
        }),
      },
    });
  };

  return (
    <TaskPickerPopover
      key={workspaceId}
      workspaceId={workspaceId}
      records={inbox.records}
      connected={inbox.connected}
      loading={inbox.loading}
      errors={inbox.errors}
      isDisabled={isDisabled}
      onRetry={inbox.refetch}
      onPick={(candidate) => attach({ candidate })}
    />
  );
};
