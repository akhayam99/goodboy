import type { ChatMessageId, ProjectId } from '@goodboy/types';
import type { WorkBrief } from './workBrief';

export type WorkBriefDraft = {
  readonly anchorMessageId: ChatMessageId | null;
  readonly brief: WorkBrief;
  readonly projectIds: ReadonlyArray<ProjectId> | null;
};
