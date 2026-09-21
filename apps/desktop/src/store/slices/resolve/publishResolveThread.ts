import { blockerCopy } from '../../../features/resolve/resolvePublishCopy';
import type { SliceParams } from './types';
import type { SessionId } from '@goodboy/types';

export const NOTHING_TO_PUBLISH = 'This comment has nothing left to publish';

type Params = SliceParams & {
  readonly sessionId: SessionId;
  readonly threadId: string;
};

export const publishResolveThread = async ({ get, sessionId, threadId }: Params): Promise<void> => {
  const preview = await get().preparePublication({ sessionId, threadIds: [threadId] });
  if (preview.publicationId === null) {
    throw new Error(
      preview.blocker === null
        ? NOTHING_TO_PUBLISH
        : blockerCopy({ blocker: preview.blocker, prNumber: preview.prNumber }).sentence,
    );
  }
  const result = await get().publishConversations({
    sessionId,
    publicationId: preview.publicationId,
  });
  if (result.kind === 'push_failed') {
    throw new Error(result.error);
  }
  if (result.kind === 'stale') {
    throw new Error('The branch moved while publishing. Read the comment again and retry');
  }
  if (result.kind === 'busy') {
    throw new Error('Another push is already running for this pull request');
  }
  if (result.kind === 'missing') {
    throw new Error(NOTHING_TO_PUBLISH);
  }
  if (result.failed > 0) {
    throw new Error('The reply did not reach the pull request. Check it and retry');
  }
};
