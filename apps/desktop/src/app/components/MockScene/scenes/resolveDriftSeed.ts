import type { ResolveQueueItemWithThread } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ThreadGitFacts } from '../../../../store/slices/resolve/threadGitState';
import { RESOLVE_SCENE_PR, SESSION_ID, THREAD_IDS, seedResolveScene } from './resolveSeed';

const MINUTE_MS = 60_000;
const ON_ORIGIN_SHA = 'c81e5aa0d95e73b6f10c8a4d29e75b3f60c19d84';
const ELSEWHERE_SHA = '5d21a0e7b1f8d4e6b27c90a3f5d81e402b7c96a1';
const MISSING_SHA = '9f2c1abc25e18d4a6b0f39c7e21548d0a6b3f9c1';

const NO_FACTS: ThreadGitFacts = {
  gitState: 'local',
  onOrigin: null,
  elsewhere: null,
  missing: null,
  folded: null,
  userReply: null,
  verdict: null,
};

const withFix = ({
  entry,
  sha,
}: {
  readonly entry: ResolveQueueItemWithThread;
  readonly sha: string;
}): ResolveQueueItemWithThread => ({
  item: {
    ...entry.item,
    approvalState: 'accepted',
    approvedRevision: entry.thread.revision,
    integratedSha: sha,
  },
  thread: {
    ...entry.thread,
    state: 'fixed',
    stage: 'approved',
    disposition: 'fix',
    commitShas: [sha],
  },
});

export const seedResolveDriftScene = (): void => {
  seedResolveScene({ expandedThreadId: THREAD_IDS.logRedact });
  const now = Date.now();
  const entries = useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
  const drifted = entries.map((entry) => {
    if (entry.thread.threadId === THREAD_IDS.logRedact) {
      return withFix({ entry, sha: ON_ORIGIN_SHA });
    }
    if (entry.thread.threadId === THREAD_IDS.typo) {
      return withFix({ entry, sha: MISSING_SHA });
    }
    return entry;
  });
  const threadGit: Readonly<Record<string, ThreadGitFacts>> = {
    [THREAD_IDS.logRedact]: {
      ...NO_FACTS,
      gitState: 'on_origin',
      onOrigin: { sha: ON_ORIGIN_SHA, branch: RESOLVE_SCENE_PR.headBranch },
    },
    [THREAD_IDS.metrics]: {
      ...NO_FACTS,
      gitState: 'fixed_elsewhere',
      elsewhere: {
        sha: ELSEWHERE_SHA,
        author: 'Theo Varga',
        handle: 'tvarga',
        subject: 'Emit the give-up metric with its reason',
        committedAt: now - 22 * MINUTE_MS,
        path: 'src/webhooks/metrics.ts',
        line: 18,
        origin: 'commit',
      },
    },
    [THREAD_IDS.typo]: {
      ...NO_FACTS,
      gitState: 'missing',
      missing: { sha: MISSING_SHA, wasPushed: false, isPathGone: false },
    },
    [THREAD_IDS.retryConstant]: {
      ...NO_FACTS,
      userReply: { commentId: 'mock-resolve-hand-reply', createdAtMs: now - 8 * MINUTE_MS },
    },
  };
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: drifted },
    sessionThreadGit: { [SESSION_ID]: threadGit },
    refreshThreadGitState: async () => undefined,
    replyAndResolveThread: async () => undefined,
    resolveThreadOnly: async () => undefined,
  });
};
