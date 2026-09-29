import type { ResolveQueueItemWithThread, ResolveVerdict } from '@goodboy/types';
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

const FOLDED_SHA = 'e31b9f4a70c2d58b1e6f3a94d0b7c25e81f6a3d0';
const REMOVED_SHA = '6b0e9f1c48a3d75e20b9f6c1a48e3d07b5c29f18';
const CHECK_MS = 1400;

type CheckDemo = 'fixed' | 'gone' | 'again' | 'checking';
type TypoDemo = 'missing' | 'folded' | 'pushed';

const VERDICTS: Readonly<Record<Exclude<CheckDemo, 'checking'>, ResolveVerdict>> = {
  fixed: {
    kind: 'fixed_elsewhere',
    evidence: 'The fix is in e31b9f4, folded in during the rebase. Line 3 now reads shouldRetry.',
    sha: FOLDED_SHA,
    checkedAt: 0,
  },
  gone: {
    kind: 'obsolete',
    evidence: 'config.ts:3 was deleted in 6b0e9f1. The retry constants moved to notify-relay.',
    sha: REMOVED_SHA,
    checkedAt: 0,
  },
  again: {
    kind: 'refix',
    evidence: 'The line is back to the old text. The fix did not survive the rebase.',
    sha: null,
    checkedAt: 0,
  },
};

const demoOf = (): { readonly check: CheckDemo | null; readonly typo: TypoDemo } => {
  const params = new URLSearchParams(window.location.search);
  const check = params.get('verdict');
  const typo = params.get('typo');
  return {
    check:
      check === 'fixed' || check === 'gone' || check === 'again' || check === 'checking'
        ? check
        : null,
    typo: typo === 'folded' || typo === 'pushed' ? typo : 'missing',
  };
};

const typoFacts = ({
  demo,
}: {
  readonly demo: { readonly check: CheckDemo | null; readonly typo: TypoDemo };
}): ThreadGitFacts => {
  if (demo.typo === 'folded') {
    return {
      ...NO_FACTS,
      gitState: 'folded',
      folded: { sha: MISSING_SHA, landedAs: FOLDED_SHA },
    };
  }
  const verdict =
    demo.check === null || demo.check === 'checking'
      ? null
      : { ...VERDICTS[demo.check], checkedAt: Date.now() };
  return {
    ...NO_FACTS,
    gitState: 'missing',
    missing: { sha: MISSING_SHA, wasPushed: demo.typo === 'pushed', isPathGone: false },
    verdict,
  };
};

export const seedResolveDriftScene = (): void => {
  const demo = demoOf();
  seedResolveScene({ expandedThreadId: THREAD_IDS.logRedact });
  const now = Date.now();
  const entries = useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
  const drifted = entries.map((entry) => {
    if (entry.thread.threadId === THREAD_IDS.logRedact) {
      return withFix({ entry, sha: ON_ORIGIN_SHA });
    }
    if (entry.thread.threadId === THREAD_IDS.typo) {
      const fixed = withFix({ entry, sha: MISSING_SHA });
      return demo.typo === 'pushed'
        ? {
            item: { ...fixed.item, deliveredAt: now - 30 * MINUTE_MS },
            thread: {
              ...fixed.thread,
              stage: 'resolved',
              replyPostedAt: now - 30 * MINUTE_MS,
            },
          }
        : fixed;
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
    [THREAD_IDS.typo]: typoFacts({ demo }),
    [THREAD_IDS.retryConstant]: {
      ...NO_FACTS,
      userReply: { commentId: 'mock-resolve-hand-reply', createdAtMs: now - 8 * MINUTE_MS },
    },
  };
  useAppStore.setState({
    sessionResolveQueueItems: { [SESSION_ID]: drifted },
    sessionThreadGit: { [SESSION_ID]: threadGit },
    sessionThreadRechecks:
      demo.check === 'checking'
        ? { [SESSION_ID]: { [THREAD_IDS.typo]: { agentId: null, error: null } } }
        : {},
    refreshThreadGitState: async () => undefined,
    replyAndResolveThread: async () => undefined,
    resolveThreadOnly: async () => undefined,
    recheckThread: async ({ threadId }) => {
      useAppStore.setState({
        sessionThreadRechecks: { [SESSION_ID]: { [threadId]: { agentId: null, error: null } } },
      });
      await new Promise((resolve) => setTimeout(resolve, CHECK_MS));
      const facts = useAppStore.getState().sessionThreadGit[SESSION_ID] ?? {};
      const current = facts[threadId];
      useAppStore.setState({
        sessionThreadRechecks: { [SESSION_ID]: {} },
        sessionThreadGit: {
          [SESSION_ID]: {
            ...facts,
            ...(current !== undefined && {
              [threadId]: { ...current, verdict: { ...VERDICTS.fixed, checkedAt: Date.now() } },
            }),
          },
        },
      });
      return 'started';
    },
  });
};
