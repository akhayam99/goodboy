import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import type { ShowToast } from '../../../../../shared/components/Toast/toastContext';
import { undoable } from '../../../../../shared/utils/undoable';
import type { DetachProjectOutcome } from '../../../../../store/slices/project-mounts/detachProject';
import type {
  EnsureProjectMountedInput,
  EnsureProjectMountedResult,
} from '../../../../../store/slices/project-mounts/types';
import { detachOutcomeMessage, type DetachOutcomeKind } from './detachPlan';
import { remountAfterUnmount } from './remountAfterUnmount';

type Params = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly worktreePath: string;
  readonly summary: Exclude<DetachOutcomeKind, 'failed'>;
  readonly outcomes: ReadonlyArray<DetachProjectOutcome>;
  readonly branchOf: ReadonlyMap<MountId, string>;
  readonly showToast: ShowToast;
  readonly ensureProjectMounted: (
    input: EnsureProjectMountedInput,
  ) => Promise<EnsureProjectMountedResult>;
};

export const announceUnmount = ({
  sessionId,
  projectId,
  projectName,
  worktreePath,
  summary,
  outcomes,
  branchOf,
  showToast,
  ensureProjectMounted,
}: Params): void => {
  const summarized = outcomes.find((outcome) => outcome.kind === summary);
  const message = detachOutcomeMessage({
    kind: summary,
    projectName,
    worktreePath: summarized?.worktreePath ?? worktreePath,
  });
  const only = outcomes.length === 1 ? outcomes[0] : undefined;
  const branch = only === undefined ? undefined : branchOf.get(only.mountId);
  if (only === undefined || branch === undefined) {
    showToast({ kind: 'info', message });
    return;
  }
  undoable({
    message,
    showToast,
    doneMessage: `Mounted ${projectName} again.`,
    undo: () =>
      remountAfterUnmount({
        sessionId,
        projectId,
        branch,
        keptPath: only.kind === 'kept' ? only.worktreePath : null,
        ensureProjectMounted,
      }),
  });
};
