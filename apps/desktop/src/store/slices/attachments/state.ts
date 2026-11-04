import type { SessionId, GoalAttachment, WorkflowRunId } from '@goodboy/types';

export type AttachmentsState = {
  readonly sessionAttachments: Readonly<Record<SessionId, ReadonlyArray<GoalAttachment>>>;
  readonly workflowRunAttachments: Readonly<Record<WorkflowRunId, ReadonlyArray<GoalAttachment>>>;
  readonly sessionScratchDirs: Readonly<Record<SessionId, string>>;
};

export const attachmentsInitialState: AttachmentsState = {
  sessionAttachments: {},
  workflowRunAttachments: {},
  sessionScratchDirs: {},
};
