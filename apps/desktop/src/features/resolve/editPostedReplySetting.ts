import type { WorkspaceId } from '@goodboy/types';

export const editPostedReplyKey = ({
  workspaceId,
}: {
  readonly workspaceId: WorkspaceId;
}): string => `review.edit_posted_reply.${workspaceId}`;

export const isEditPostedReplyOn = ({
  raw,
}: {
  readonly raw: string | null | undefined;
}): boolean => raw !== '0';

export const EDIT_POSTED_REPLY_OFF = '0';
export const EDIT_POSTED_REPLY_ON = '1';
