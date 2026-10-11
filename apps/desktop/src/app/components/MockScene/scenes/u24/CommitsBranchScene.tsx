import { useEffect } from 'react';
import type { HistoryGraph, WorktreeStatus } from '@goodboy/types';
import { initialPlanItems, setVerb } from '../../../../../features/history/historyPlan';
import { useAppStore } from '../../../../../store';
import type { HistoryDraft } from '../../../../../store/slices/history/types';
import { sceneClock } from '../../sceneClock';
import { handlersFor } from '../brand/DiffStage';
import { CTX_BASE_SHA, CTX_COMMITS } from '../brand/contextBranch';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';
import { mockSceneIpc } from '../mockSceneIpc';
import { SESSION_ID } from '../resolveSeed';
import { U21_BRANCH_SCENES } from '../u21/branch';
import { REBASE_JOB_MOUNT_ID } from './rebaseJobSeed';

type Props = {
  readonly isPlanned: boolean;
  readonly stageWidth?: number;
};

const HANDLERS = handlersFor(BRANCH_FILES_PATCH);

const clock = sceneClock({ anchor: '2026-10-10T09:12:00.000Z' });

const BRANCH = 'hl/fix-duplicate-credit';

const MAIN_HEAD = '7c21e0a110000000000000000000000000000000';

const GRAPH: HistoryGraph = {
  baseRef: 'origin/main',
  mergeBase: {
    sha: CTX_BASE_SHA,
    subject: 'Release 2.14',
    author: 'Lena Arkwright',
    timestamp: Math.floor(clock.ms({ at: '2026-10-07T09:12:00.000Z' }) / 1000),
  },
  mainHead: MAIN_HEAD,
  mainCommits: [
    {
      sha: MAIN_HEAD,
      subject: 'Merge #208: Cascadia rounding rules',
      author: 'Lena Arkwright',
      timestamp: Math.floor(clock.ms({ at: '2026-10-10T05:12:00.000Z' }) / 1000),
    },
  ],
  behind: 15,
  remoteSha: CTX_COMMITS[0]?.sha ?? null,
  files: [],
};

const ITEMS = initialPlanItems({ commits: CTX_COMMITS });

const PLANNED_ITEMS = (() => {
  const last = CTX_COMMITS[1]?.sha;
  return last === undefined ? ITEMS : setVerb({ items: ITEMS, sha: last, verb: 'drop' });
})();

type DraftParams = {
  readonly isPlanned: boolean;
};

const draftOf = ({ isPlanned }: DraftParams): HistoryDraft => ({
  sessionId: SESSION_ID,
  mountId: REBASE_JOB_MOUNT_ID,
  planId: 'mock-u24-commits-plan',
  branch: BRANCH,
  baseSha: CTX_BASE_SHA,
  headSha: CTX_COMMITS[0]?.sha ?? CTX_BASE_SHA,
  commits: CTX_COMMITS,
  items: isPlanned ? PLANNED_ITEMS : ITEMS,
  onto: null,
  graph: GRAPH,
  undo: [],
  prediction: null,
  isPredicting: false,
  loadError: null,
});

const STATUS: WorktreeStatus = {
  branch: BRANCH,
  head: CTX_COMMITS[0]?.sha ?? null,
  headSubject: CTX_COMMITS[0]?.subject ?? null,
  upstream: `origin/${BRANCH}`,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: CTX_COMMITS.length, behind: 15 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  inProgress: null,
};

const BaseScene = U21_BRANCH_SCENES['branch-description-open'];

export const CommitsBranchScene = ({ isPlanned, stageWidth }: Props) => {
  useEffect(() => {
    mockSceneIpc((command, payload) => {
      if (command === 'gh_run') {
        const args =
          typeof payload === 'object' && payload !== null && 'args' in payload ? payload.args : [];
        const isGraphql = Array.isArray(args) && args.includes('graphql');
        const empty = {
          data: {
            repository: {
              pullRequest: {
                reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: [] },
              },
            },
          },
        };
        return { stdout: isGraphql ? JSON.stringify(empty) : '[]', stderr: '', exitCode: 0 };
      }
      if (command === 'worktree_status') {
        return STATUS;
      }
      return HANDLERS[command]?.(undefined) ?? null;
    });
    useAppStore.setState((current) => ({
      branchTab: { ...current.branchTab, [SESSION_ID]: 'commits' },
      historyDrafts: { ...current.historyDrafts, [REBASE_JOB_MOUNT_ID]: draftOf({ isPlanned }) },
      historyRuns: {},
      loadHistoryDraft: async () => undefined,
    }));
  }, [isPlanned]);
  if (stageWidth === undefined) {
    return <BaseScene />;
  }
  return (
    <div style={{ width: stageWidth }}>
      <BaseScene />
    </div>
  );
};
