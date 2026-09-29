import type { SessionId, GoalAttachment, WorkflowRunId } from '@goodboy/types';

export type AttachmentsState = {
  readonly sessionAttachments: Readonly<Record<SessionId, ReadonlyArray<GoalAttachment>>>;
  readonly workflowRunAttachments: Readonly<Record<WorkflowRunId, ReadonlyArray<GoalAttachment>>>;
};

export const attachmentsInitialState: AttachmentsState = {
  sessionAttachments: {},
  workflowRunAttachments: {},
};
