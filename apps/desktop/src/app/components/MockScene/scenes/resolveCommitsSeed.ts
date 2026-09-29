import type {
  BranchCommit,
  HistoryPlanPrediction,
  HistoryStep,
  MountId,
  ResolveQueueItemWithThread,
  SessionProjectMount,
} from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type {
  HistoryDraft,
  HistoryRun,
  HistoryRunPhase,
} from '../../../../store/slices/history/types';
import { isFolded, targetOf } from '../../../../features/history/historyPlan';
import {
  EXPANDED_THREAD_ID,
  MOUNT_TARGET,
  PROJECT_ID,
  RESOLVE_SCENE_PR,
  SESSION_ID,
  THREAD_IDS,
  seedResolveScene,
} from './resolveSeed';

const MOUNT_ID: MountId = MOUNT_TARGET.mountId;
const BACKUP_REF = 'refs/goodboy/backup/318-1042';
const STEP_MS = 900;

const full = (short: string): string => short.padEnd(40, '0');

const COMMITS: ReadonlyArray<BranchCommit> = [
  { seed: 'd4e7b20', subject: 'Emit one metric per attempt', pushed: false },
  { seed: '9f2c1ab', subject: 'fixup! Add the retry policy', pushed: true },
  { seed: 'c81e5aa', subject: 'Stop retrying forever on a 429', pushed: true },
  { seed: '7be41d0', subject: 'Add the retry policy', pushed: true },
  { seed: '3f9a2c1', subject: 'Dedupe webhook credits on the event id', pushed: true },
].map(({ seed, subject, pushed }, index, all) => ({
  sha: full(seed),
  shortSha: seed,
  subject,
  author: 'Ines Okafor',
  timestamp: Date.parse('2026-09-04T13:00:00.000Z') - index * 600_000,
  pushed,
  parentSha: all[index + 1] === undefined ? full('b0a1c2d') : full(all[index + 1]?.seed ?? ''),
}));

const LINKS: ReadonlyArray<{
  readonly threadId: string;
  readonly sha: string;
  readonly fixupOf: string | null;
}> = [
  { threadId: EXPANDED_THREAD_ID, sha: full('c81e5aa'), fixupOf: full('7be41d0') },
  { threadId: THREAD_IDS.typo, sha: full('9f2c1ab'), fixupOf: null },
  { threadId: THREAD_IDS.metrics, sha: full('d4e7b20'), fixupOf: full('3f9a2c1') },
];

const KNOWN: Readonly<Record<string, string>> = {
  '7be41d0+c81e5aa+9f2c1ab': 'e31b9f4',
  '3f9a2c1+d4e7b20': 'a52d7c8',
  'c81e5aa+9f2c1ab+d4e7b20': 'b90e6d3',
};

const hash = (text: string): string => {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value = Math.imul(value ^ text.charCodeAt(index), 16777619) >>> 0;
  }
  return value.toString(16).padStart(8, '4').slice(0, 7);
};

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: MOUNT_TARGET.worktreePath,
  lastWorktreePath: null,
  repoRoot: MOUNT_TARGET.worktreePath,
  branch: RESOLVE_SCENE_PR.headBranch,
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: MOUNT_TARGET.mountRevision,
};

const rootOf = ({ step }: { readonly step: HistoryStep }): string =>
  isFolded({ step }) ? (targetOf({ step }) ?? step.sha) : step.sha;

const newShas = ({
  items,
}: {
  readonly items: ReadonlyArray<HistoryStep>;
}): ReadonlyMap<string, string> => {
  const members = new Map<string, string[]>();
  for (const step of items) {
    const root = rootOf({ step });
    members.set(root, [...(members.get(root) ?? []), step.sha.slice(0, 7)]);
  }
  const result = new Map<string, string>();
  let isDirty = false;
  for (const step of items.filter((candidate) => !isFolded({ step: candidate }))) {
    const group = members.get(step.sha) ?? [];
    isDirty = isDirty || group.length > 1 || step.verb !== 'pick';
    const key = group.join('+');
    result.set(
      step.sha,
      isDirty ? full(KNOWN[key] ?? hash(`${key}|${step.message ?? ''}`)) : step.sha,
    );
  }
  return result;
};

const predictionOf = ({
  items,
}: {
  readonly items: ReadonlyArray<HistoryStep>;
}): HistoryPlanPrediction => {
  const shas = newShas({ items });
  const kept = items.filter((step) => !isFolded({ step }));
  return {
    isSupported: true,
    steps: items.map((step) => ({
      sha: step.sha,
      outcome: 'clean',
      files: [],
      newSha: shas.get(rootOf({ step })) ?? null,
    })),
    head: shas.get(kept.at(-1)?.sha ?? '') ?? null,
    isTreeEqual: true,
    changedFiles: [],
  };
};

const draftOf = ({ commits }: { readonly commits: ReadonlyArray<BranchCommit> }): HistoryDraft => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  planId: null,
  branch: RESOLVE_SCENE_PR.headBranch,
  baseSha: commits.at(-1)?.parentSha ?? '',
  headSha: commits[0]?.sha ?? '',
  commits,
  items: [...commits].reverse().map((commit) => ({ sha: commit.sha, verb: 'pick' })),
  onto: null,
  graph: null,
  undo: [],
  prediction: null,
  isPredicting: false,
  loadError: null,
});

const runOf = ({
  phase,
  patch,
}: {
  readonly phase: HistoryRunPhase;
  readonly patch: Partial<HistoryRun>;
}): HistoryRun => ({
  sessionId: SESSION_ID,
  mountId: MOUNT_ID,
  origin: 'plan',
  phase,
  planId: null,
  agentId: null,
  copyPath: null,
  stop: null,
  result: null,
  backupRef: null,
  remoteSha: null,
  holder: null,
  progress: null,
  applied: null,
  identity: null,
  movedHead: null,
  threadShas: [],
  updatedAt: Date.now(),
  ...patch,
});

const setRun = (run: HistoryRun): void => {
  useAppStore.setState((state) => ({ historyRuns: { ...state.historyRuns, [MOUNT_ID]: run } }));
};

const linkThreads = ({
  entries,
  moves,
}: {
  readonly entries: ReadonlyArray<ResolveQueueItemWithThread>;
  readonly moves: ReadonlyMap<string, string>;
}): ReadonlyArray<ResolveQueueItemWithThread> =>
  entries.map((entry) => {
    const link = LINKS.find((candidate) => candidate.threadId === entry.thread.threadId);
    if (link === undefined) {
      return entry;
    }
    const sha = moves.get(link.sha) ?? link.sha;
    const fixupOf = link.fixupOf === null ? null : (moves.get(link.fixupOf) ?? link.fixupOf);
    return {
      item: { ...entry.item, approvalState: 'accepted', approvedRevision: entry.thread.revision },
      thread: {
        ...entry.thread,
        state: 'fixed',
        stage: 'approved',
        disposition: 'fix',
        commitShas: [sha],
        fixupOfSha: fixupOf,
      },
    };
  });

const wait = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, STEP_MS);
  });

export const seedResolveCommitsScene = (): void => {
  seedResolveScene({ expandedThreadId: null });
  const original = useAppStore.getState().sessionResolveQueueItems[SESSION_ID] ?? [];
  const seedEntries = (moves: ReadonlyMap<string, string>) =>
    linkThreads({ entries: original, moves });
  useAppStore.setState({
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    sessionResolveQueueItems: { [SESSION_ID]: seedEntries(new Map()) },
    historyDrafts: { [MOUNT_ID]: draftOf({ commits: COMMITS }) },
    historyRuns: {},
    reviewCommitPresets: {},
    refreshThreadGitState: async () => undefined,
    loadHistoryDraft: async () => undefined,
    loadReviewCommitPreset: async () => undefined,
    reviewCommitDrafts: {},
    loadReviewCommitDraft: async () => undefined,
    markReviewCommitDraft: async ({ mountId, signature }) => {
      useAppStore.setState((state) => ({
        reviewCommitDrafts: { ...state.reviewCommitDrafts, [mountId]: signature },
      }));
    },
    chooseReviewCommitPreset: async ({ projectId, preset }) => {
      useAppStore.setState((state) => ({
        reviewCommitPresets: { ...state.reviewCommitPresets, [projectId]: preset },
      }));
    },
    editHistoryDraft: async ({ items, onto }) => {
      useAppStore.setState((state) => {
        const draft = state.historyDrafts[MOUNT_ID];
        if (draft === undefined) {
          return state;
        }
        return {
          historyDrafts: {
            ...state.historyDrafts,
            [MOUNT_ID]: {
              ...draft,
              items,
              onto: onto ?? null,
              prediction: predictionOf({ items }),
              isPredicting: false,
            },
          },
        };
      });
    },
    applyHistoryDraft: async ({ shouldPush }) => {
      const draft = useAppStore.getState().historyDrafts[MOUNT_ID];
      if (draft === undefined) {
        return 'stopped';
      }
      setRun(runOf({ phase: 'trying', patch: { progress: { stage: 'copy' } } }));
      await wait();
      setRun(runOf({ phase: 'trying', patch: { progress: { stage: 'check' } } }));
      await wait();
      setRun(runOf({ phase: 'applying', patch: {} }));
      await wait();
      if (shouldPush) {
        setRun(runOf({ phase: 'pushing', patch: { backupRef: BACKUP_REF } }));
        await wait();
      }
      const shas = newShas({ items: draft.items });
      const moves = new Map<string, string>();
      for (const step of draft.items) {
        const next = shas.get(rootOf({ step }));
        if (next !== undefined) {
          moves.set(step.sha, next);
        }
      }
      const byOld = new Map(draft.commits.map((commit) => [commit.sha, commit]));
      const rewritten = draft.items
        .filter((step) => !isFolded({ step }))
        .map((step): BranchCommit => {
          const before = byOld.get(step.sha);
          const sha = shas.get(step.sha) ?? step.sha;
          return {
            sha,
            shortSha: sha.slice(0, 7),
            subject: step.message ?? before?.subject ?? '',
            author: before?.author ?? '',
            timestamp: before?.timestamp ?? 0,
            pushed: sha === step.sha ? (before?.pushed ?? false) : shouldPush,
            parentSha: null,
          };
        })
        .reverse();
      useAppStore.setState({
        sessionResolveQueueItems: { [SESSION_ID]: seedEntries(moves) },
        historyDrafts: { [MOUNT_ID]: draftOf({ commits: rewritten }) },
      });
      setRun(
        runOf({
          phase: shouldPush ? 'pushed' : 'applied',
          patch: { backupRef: BACKUP_REF, movedHead: rewritten[0]?.sha ?? null },
        }),
      );
      return shouldPush ? 'pushed' : 'applied';
    },
    restoreHistory: async () => {
      useAppStore.setState({
        sessionResolveQueueItems: { [SESSION_ID]: seedEntries(new Map()) },
        historyDrafts: { [MOUNT_ID]: draftOf({ commits: COMMITS }) },
      });
      setRun(runOf({ phase: 'restored', patch: {} }));
      return 'restored';
    },
  });
};
