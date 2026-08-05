import type { GetFn, SlackThreadParams } from './types';

type Params = SlackThreadParams & {
  readonly get: GetFn;
  readonly write: () => Promise<void>;
};

export const runSlackWrite = async ({
  get,
  workspaceId,
  channelId,
  threadTs,
  write,
}: Params): Promise<void> => {
  await write();
  await get().refreshSlackThread({ workspaceId, channelId, threadTs }, { force: true });
  await get().refreshSlackThreadHeads({ workspaceId, channelId });
};
