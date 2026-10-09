import { REVIEW_SOURCE_CAPABILITIES, type ReviewSource } from './types';

type Params = Readonly<{
  closeNote: (params: { readonly threadId: string }) => Promise<void>;
}>;

export const LOCAL_NOTE_NO_REPLY = 'A note on this machine has nobody to reply to';

export const localReviewSource = ({ closeNote }: Params): ReviewSource => ({
  kind: 'local',
  capabilities: REVIEW_SOURCE_CAPABILITIES.local,
  listThreads: async () => [],
  reply: async () => {
    throw new Error(LOCAL_NOTE_NO_REPLY);
  },
  resolve: async ({ providerThreadId }) => {
    await closeNote({ threadId: providerThreadId });
    return { isResolved: true };
  },
  readRemoteHead: async () => null,
  commitLink: () => null,
  pullRequest: null,
});
