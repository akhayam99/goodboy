import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectSessionDraft } from '../../../../store/slices/sessionDraft/selectSessionDraft';
import { PromptField } from '../../../../shared/components/PromptField';
import { START_KIND_COPY } from '../../startKind/startKindCopy';
import { DraftTasks } from './DraftTasks';
import { TaskPicker } from './TaskPicker';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isDisabled: boolean;
  readonly isSubmitBlocked: boolean;
  readonly onSubmit: () => void;
};

export const StartTaskField = ({ workspaceId, isDisabled, isSubmitBlocked, onSubmit }: Props) => {
  const goal = useAppStore((state) => selectSessionDraft({ state, workspaceId }).workflowGoal);
  const hasTask = useAppStore(
    (state) => selectSessionDraft({ state, workspaceId }).pickedIssues.length > 0,
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);

  return (
    <section aria-label={START_KIND_COPY.goal} className="flex flex-col gap-2">
      <DraftTasks workspaceId={workspaceId} />
      <PromptField
        kind="message"
        label={START_KIND_COPY.goal}
        value={goal}
        onChange={(next) => patchSessionDraft({ workspaceId, patch: { workflowGoal: next } })}
        onSubmit={onSubmit}
        isSubmitBlocked={isSubmitBlocked}
        placeholder={START_KIND_COPY.goalPlaceholder}
        disabled={isDisabled}
        minRows={2}
        maxRows={8}
        keyLabels={{ send: 'start' }}
        isKickoffField
        footerStart={
          hasTask ? null : <TaskPicker workspaceId={workspaceId} isDisabled={isDisabled} />
        }
      />
    </section>
  );
};
