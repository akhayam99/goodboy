import { useState } from 'react';
import { Button, FormActions, Input } from '@goodboy/ui';
import type { SessionExternalTask, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectProjectById } from '../../../../store/slices/projects/selectProjectById';
import { taskBranchPreview } from './taskBranchPreview';

type Props = {
  readonly sessionId: SessionId;
  readonly task: SessionExternalTask;
  readonly onBack: () => void;
  readonly onDone: () => void;
};

export const TaskWorktreeForm = ({ sessionId, task, onBack, onDone }: Props) => {
  const forkMount = useAppStore((state) => state.forkMount);
  const assignSessionExternalTask = useAppStore((state) => state.assignSessionExternalTask);
  const reportError = useAppStore((state) => state.reportError);
  const projectId = useAppStore(
    (state) => task.projectId ?? state.sessionProjectMounts[sessionId]?.[0]?.projectId,
  );
  const projectName = useAppStore((state) =>
    projectId === undefined ? '' : (selectProjectById(state, projectId)?.name ?? ''),
  );
  const preview = useAppStore((state) => taskBranchPreview({ state, sessionId, projectId, task }));
  const [branch, setBranch] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const create = async () => {
    if (projectId === undefined) {
      return;
    }
    setIsBusy(true);
    try {
      const trimmed = branch.trim();
      const mount = await forkMount({
        sessionId,
        projectId,
        taskIdentifier: task.identifier,
        taskTitle: task.title,
        ...(trimmed === '' ? {} : { branch: trimmed }),
      });
      await assignSessionExternalTask({
        sessionId,
        task,
        branch: mount.branch,
        projectId,
      });
      onDone();
    } catch (error) {
      void reportError({
        title: `Couldn't create a worktree for ${task.identifier}`,
        error,
        sessionId,
      });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-1">
        <span className="text-row text-foreground">{`New worktree for ${task.identifier}`}</span>
        <span className="text-meta text-muted-foreground">
          {projectName === '' ? 'It gets its own branch.' : `${projectName} · from its base branch`}
        </span>
      </div>
      <Input
        value={branch}
        autoFocus
        disabled={isBusy}
        aria-label="Branch name"
        placeholder={preview ?? 'Leave empty to name it automatically'}
        onChange={(event) => setBranch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') {
            return;
          }
          event.preventDefault();
          void create();
        }}
        className="h-8 w-full text-label"
      />
      <span className="text-meta text-muted-foreground">
        {`Leave it empty to use ${preview ?? 'an automatic name'}.`}
      </span>
      <FormActions>
        <Button size="sm" variant="ghost" disabled={isBusy} onClick={onBack}>
          Back
        </Button>
        <Button size="sm" disabled={isBusy} onClick={() => void create()}>
          {isBusy ? 'Creating…' : 'Create worktree'}
        </Button>
      </FormActions>
    </div>
  );
};
