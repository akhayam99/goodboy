import type { SessionProjectMount } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import type { StoryStore } from '../../../store/storyHarness';
import { A_REBASE_MOUNT_ID, A_REBASE_SESSION_ID } from './aRebaseRun';
import { LEDGER_COMMITS, LEDGER_GRAPH } from './ledgerFixture';
import { initialPlanItems } from '../historyPlan';

type Params = { readonly store: StoryStore };

export const seedLiveHistory = ({ store }: Params) => {
  const project = aProject({ name: 'payments-api', baseBranch: 'main' });
  const mount: SessionProjectMount = {
    mountId: A_REBASE_MOUNT_ID,
    sessionId: A_REBASE_SESSION_ID,
    projectId: project.id,
    mountName: 'payments-api',
    worktreePath: '/w/payments-api',
    lastWorktreePath: null,
    repoRoot: '/repos/payments-api',
    branch: 'hl/ledger-export',
    baseBranch: 'main',
    parallelIndex: 0,
    isAttached: true,
    diskState: 'present',
    revision: 1,
  };
  const input = { sessionId: mount.sessionId, mountId: mount.mountId };
  store.setState({
    sessions: [aSession({ id: mount.sessionId })],
    projects: [project],
    sessionProjectMounts: { [mount.sessionId]: [mount] },
    historyDrafts: {
      [mount.mountId]: {
        ...input,
        planId: null,
        branch: mount.branch,
        baseSha: LEDGER_GRAPH.mergeBase.sha,
        headSha: LEDGER_COMMITS[0]?.sha ?? '',
        commits: LEDGER_COMMITS,
        items: initialPlanItems({ commits: LEDGER_COMMITS }),
        onto: null,
        graph: LEDGER_GRAPH,
        undo: [],
        prediction: null,
        isPredicting: false,
        loadError: null,
      },
    },
  });
  return { input, mount, project };
};
