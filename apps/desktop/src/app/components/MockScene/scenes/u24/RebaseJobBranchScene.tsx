import { useEffect } from 'react';
import type { WorktreeStatus } from '@goodboy/types';
import { initialPlanItems } from '../../../../../features/history/historyPlan';
import { useAppStore } from '../../../../../store';
import type { HistoryDraft } from '../../../../../store/slices/history/types';
import { handlersFor } from '../brand/DiffStage';
import { CTX_BASE_SHA, CTX_COMMITS } from '../brand/contextBranch';
import { BRANCH_FILES_PATCH } from '../brand/contextDiffPatch';
import { mockSceneIpc } from '../mockSceneIpc';
import { SESSION_ID } from '../resolveSeed';
import { U21_BRANCH_SCENES } from '../u21/branch';
import {
  REBASE_JOB_MOUNT_ID,
  dirtyCountOfRebaseJobState,
  rebaseJobRunOf,
  rebaseJobSceneStateOf,
  type RebaseJobSceneState,
} from './rebaseJobSeed';

const HANDLERS = handlersFor(BRANCH_FILES_PATCH);

const DRAFT: HistoryDraft = {
  sessionId: SESSION_ID,
  mountId: REBASE_JOB_MOUNT_ID,
  planId: 'mock-u24-rebase-job-plan',
  branch: 'hl/fix-duplicate-credit',
  baseSha: CTX_BASE_SHA,
  headSha: CTX_COMMITS[0]?.sha ?? CTX_BASE_SHA,
  commits: CTX_COMMITS,
  items: initialPlanItems({ commits: CTX_COMMITS }),
  onto: null,
  graph: null,
  undo: [],
  prediction: null,
  isPredicting: false,
  loadError: null,
};

type StatusOfParams = {
  readonly state: RebaseJobSceneState;
};

const statusOf = ({ state }: StatusOfParams): WorktreeStatus => {
  const changed = dirtyCountOfRebaseJobState({ state });
  return {
    branch: 'hl/fix-duplicate-credit',
    head: CTX_COMMITS[0]?.sha ?? null,
    headSubject: CTX_COMMITS[0]?.subject ?? null,
    upstream: 'origin/hl/fix-duplicate-credit',
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    mainDistance: { kind: 'known', ahead: CTX_COMMITS.length, behind: 18 },
    workingTree: {
      kind: 'known',
      staged: changed === 0 ? 0 : 4,
      unstaged: changed === 0 ? 0 : 5,
      untracked: changed === 0 ? 0 : 2,
      unmerged: 0,
      changed,
    },
    inProgress: null,
  };
};

const BaseScene = U21_BRANCH_SCENES['branch-description-open'];

export const RebaseJobBranchScene = () => {
  useEffect(() => {
    const state = rebaseJobSceneStateOf();
    const tab = new URLSearchParams(window.location.search).get('tab') === 'pr' ? 'pr' : 'commits';
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
        return statusOf({ state });
      }
      return HANDLERS[command]?.(undefined) ?? null;
    });
    useAppStore.setState((current) => ({
      branchTab: { ...current.branchTab, [SESSION_ID]: tab },
      historyDrafts: { ...current.historyDrafts, [REBASE_JOB_MOUNT_ID]: DRAFT },
      historyRuns: {
        ...current.historyRuns,
        [REBASE_JOB_MOUNT_ID]: rebaseJobRunOf({ state, sessionId: SESSION_ID }),
      },
      loadHistoryDraft: async () => undefined,
    }));
  }, []);
  return <BaseScene />;
};
