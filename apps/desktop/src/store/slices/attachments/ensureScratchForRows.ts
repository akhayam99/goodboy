import type { GoalAttachment, GoalAttachmentOwner } from '@goodboy/types';
import { ensureScratchDir } from './ensureScratchDir';
import { isScratchAttachment } from './isScratchAttachment';
import { sessionIdOfOwner } from './sessionIdOfOwner';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly owner: GoalAttachmentOwner;
  readonly attachments: ReadonlyArray<GoalAttachment>;
};

export const ensureScratchForRows = async ({
  set,
  get,
  owner,
  attachments,
}: Params): Promise<void> => {
  if (!attachments.some((attachment) => isScratchAttachment({ relPath: attachment.relPath }))) {
    return;
  }
  const sessionId = sessionIdOfOwner({ get, owner });
  if (sessionId === null) {
    return;
  }
  await ensureScratchDir({ set, get, sessionId });
};
