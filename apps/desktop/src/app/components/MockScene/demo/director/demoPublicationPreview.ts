import type {
  ResolvePublicationPreview,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import type { AppStore } from '../../../../../store/store';
import { activeReviewSourceOf } from '../../../../../store/slices/review-source/activeReviewSource';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadIds?: ReadonlyArray<string> | undefined;
};

type EntryParams = {
  readonly entry: ResolveQueueItemWithThread;
};

const fixShasOf = ({ entry }: EntryParams): ReadonlyArray<string> =>
  entry.thread.disposition === 'fix' ? (entry.thread.commitShas ?? []) : [];

export const demoPublicationPreview = ({
  state,
  sessionId,
  threadIds,
}: Params): ResolvePublicationPreview => {
  const wanted = threadIds === undefined ? null : new Set(threadIds);
  const approved = (state.sessionResolveQueueItems[sessionId] ?? []).filter(
    (entry) =>
      entry.item.approvalState === 'accepted' &&
      entry.thread.replyPostedAt === null &&
      (wanted === null || wanted.has(entry.thread.threadId)),
  );
  const source = activeReviewSourceOf({ state, sessionId });
  const shas = [...new Set(approved.flatMap((entry) => fixShasOf({ entry })))];
  const frozenAt = Date.now();
  return {
    publicationId: approved.length === 0 ? null : `demo-publication-${crypto.randomUUID()}`,
    repo: source?.repo ?? null,
    prNumber: source?.prNumber ?? 0,
    branch: source?.headBranch ?? '',
    localHead: shas.at(-1) ?? '',
    remoteHead: null,
    requiresPush: shas.length > 0,
    frozenAt,
    commits: shas.map((sha) => ({
      sha,
      shortSha: sha.slice(0, 7),
      subject: 'Address review comments',
      author: 'resolver',
      timestamp: frozenAt,
      pushed: false,
      parentSha: null,
      threadIds: approved
        .filter((entry) => fixShasOf({ entry }).includes(sha))
        .map((entry) => entry.thread.threadId),
    })),
    unapproved: [],
    replies: approved.flatMap((entry) =>
      entry.thread.replyDraft === null
        ? []
        : [
            {
              threadId: entry.thread.threadId,
              body: entry.thread.replyDraft,
              revision: entry.thread.revision,
              closes: entry.thread.disposition === 'fix',
            },
          ],
    ),
    notes: approved.flatMap((entry) =>
      entry.thread.replyDraft === null
        ? [{ threadId: entry.thread.threadId, revision: entry.thread.revision, closes: false }]
        : [],
    ),
    excluded: [],
    drift: [],
    blocker: null,
  };
};
