import { useEffect, useRef, useState } from 'react';
import type { Session } from '@goodboy/types';
import { BranchPage } from '../../../../../features/branch/components/BranchPage';
import { WorktreeSceneColumn } from '../WorktreeSceneColumn';
import { useAppStore } from '../../../../../store';
import { seedLiveHistory } from '../../../../../features/history/testing/seedLiveHistory';
import { A_REBASE_MOUNT_ID } from '../../../../../features/history/testing/aRebaseRun';
import {
  LEDGER_COMMITS,
  LEDGER_GRAPH,
  LEDGER,
} from '../../../../../features/history/testing/ledgerFixture';
import {
  initialPlanItems,
  rewordStep,
  setVerb,
  moveAbove,
} from '../../../../../features/history/historyPlan';
import { sceneClock } from '../../sceneClock';
import { installSceneDatabase } from '../sceneDatabase';
import { installScenePlanEngine } from '../scenePlanEngine';
import { RESOLVE_SCENE_PR } from '../resolveSeed';
import { prViewsOf } from '../prViewsOf';

type Props = { readonly mode: 'edited' | 'busy' | 'conflict' | 'stash' };

const clock = sceneClock({ anchor: '2026-10-12T09:00:00.000Z' });
const now = clock.iso({ at: '2026-10-12T09:00:00.000Z' });
const commitsBefore = LEDGER_COMMITS.map((commit, index) => ({
  ...commit,
  timestamp: Math.floor(clock.ms({ at: '2026-10-12T09:00:00.000Z' }) / 1000) - (index + 1) * 3600,
}));
const rewriteIndex = commitsBefore.findIndex((commit) => commit.sha === LEDGER.c);
type ShaParams = { readonly sha: string; readonly index: number };
const rewrittenSha = ({ sha, index }: ShaParams): string =>
  index <= rewriteIndex ? `ed17${sha.slice(4)}` : sha;
const commitsAfter = commitsBefore.map((commit, index) => ({
  ...commit,
  sha: rewrittenSha({ sha: commit.sha, index }),
  shortSha: rewrittenSha({ sha: commit.sha, index }).slice(0, 7),
  parentSha:
    commitsBefore[index + 1] === undefined
      ? commit.parentSha
      : rewrittenSha({ sha: commitsBefore[index + 1]?.sha ?? '', index: index + 1 }),
  subject: commit.sha === LEDGER.c ? 'Guard the Acme export' : commit.subject,
  pushed: index <= rewriteIndex ? false : commit.pushed,
}));

export const LiveEditScene = ({ mode }: Props) => {
  const [session, setSession] = useState<Session | null>(null);
  const hasStarted = useRef(false);
  const live = useAppStore((state) => state.historyLiveSessions[A_REBASE_MOUNT_ID]);
  useEffect(() => {
    const { input, mount } = seedLiveHistory({ store: useAppStore });
    installScenePlanEngine({ sessionId: input.sessionId });
    const editedCommits =
      mode === 'stash' ? commitsBefore.filter((commit) => commit.sha !== LEDGER.f) : commitsAfter;
    const editedHead = editedCommits[0]?.sha ?? LEDGER.f;
    let isEdited = false;
    let shouldPause = mode === 'stash';
    installSceneDatabase({
      fallback: ({ command }) => {
        if (command === 'worktree_commits') {
          return isEdited ? editedCommits : commitsBefore;
        }
        if (command === 'worktree_status') {
          return {
            branch: mount.branch,
            head: isEdited ? editedHead : LEDGER.f,
            headSubject: (isEdited ? editedCommits : commitsBefore)[0]?.subject ?? null,
            upstream: `origin/${mount.branch}`,
            upstreamDistance: {
              kind: 'known',
              ahead: isEdited ? (mode === 'stash' ? editedCommits.length - 3 : 5) : 4,
              behind: isEdited && mode !== 'stash' ? 1 : 0,
            },
            mainDistance: {
              kind: 'known',
              ahead: (isEdited ? editedCommits : commitsBefore).length,
              behind: LEDGER_GRAPH.behind,
            },
            workingTree: {
              kind: 'known',
              staged: 0,
              unstaged: 0,
              untracked: 0,
              unmerged: 0,
              changed: 0,
            },
          };
        }
        if (command === 'history_graph') {
          return {
            ...LEDGER_GRAPH,
            mergeBase: {
              ...LEDGER_GRAPH.mergeBase,
              timestamp: Math.floor(clock.ms({ at: '2026-10-10T09:00:00.000Z' }) / 1000),
            },
          };
        }
        if (command === 'history_live_edit') {
          if (mode === 'busy') {
            return new Promise<never>(() => undefined);
          }
          if (mode === 'conflict') {
            return {
              kind: 'stopped',
              result: {
                head: null,
                map: [],
                isTreeEqual: false,
                changedFiles: [],
                stop: {
                  sha: LEDGER.f,
                  index: 0,
                  kind: 'merge',
                  files: ['export.ts'],
                  message: 'export.ts conflicts',
                },
                copyPath: null,
                order: [],
                check: null,
              },
            };
          }
          if (shouldPause) {
            shouldPause = false;
            return {
              kind: 'finished',
              outcome: { kind: 'needs-stash', dirtyCount: 1, files: ['export.ts'] },
              map: [],
            };
          }
          isEdited = true;
          return {
            kind: 'finished',
            outcome: {
              kind: 'moved',
              head: editedHead,
              backupRef:
                'refs/goodboy/backup/b-686c2f6c65646765722d6578706f7274/1791800000000000000',
              carriedCount: 0,
            },
            map: [],
          };
        }
        if (command === 'history_restore') {
          isEdited = !isEdited;
          return {
            kind: 'moved',
            head: isEdited ? editedHead : LEDGER.f,
            backupRef: 'refs/goodboy/backup/b-686c2f6c65646765722d6578706f7274/1791800000000000001',
            carriedCount: 0,
          };
        }
        if (command === 'worktree_diff') {
          return '';
        }
        return null;
      },
    });
    const seeded = useAppStore.getState().sessions[0];
    if (seeded === undefined) {
      throw new Error('The live-edit scene needs its session.');
    }
    const shown = { ...seeded, title: 'Guard the ledger export', createdAt: now, updatedAt: now };
    useAppStore.setState({
      sessions: [shown],
      branchTab: { [input.sessionId]: 'commits' },
      sessionActiveMount: { [input.sessionId]: input.mountId },
      diffMountPath: { [input.sessionId]: mount.worktreePath },
      currentSessionId: input.sessionId,
      sessionResolveThreads: {},
      mountGithub: {
        [input.mountId]: {
          linkedIssues: [],
          fetchedAt: now,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
          pr: {
            ...RESOLVE_SCENE_PR,
            title: 'Guard the ledger export',
            headBranch: mount.branch,
            headSha: LEDGER.c,
            author: 'nadia-p',
            updatedAt: now,
          },
          mountId: input.mountId,
          projectId: mount.projectId,
          revision: mount.revision,
          repository: 'harborline/payments-api',
          host: 'github.com',
          branch: mount.branch,
          prs: [],
          links: [],
        },
      },
      pullRequestViews: prViewsOf({
        sessionId: input.sessionId,
        mountId: input.mountId,
        pr: { ...RESOLVE_SCENE_PR, author: 'nadia-p', headBranch: mount.branch },
        commits: mode === 'stash' ? commitsBefore : commitsAfter,
      }),
      refreshSessionPr: async () => undefined,
      refreshSessionPrDetail: async () => undefined,
      loadPullRequestView: async () => undefined,
    });
    setSession(shown);
  }, [mode]);
  useEffect(() => {
    if (live === undefined || session === null || hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    void useAppStore.getState().changeLiveHistory({
      sessionId: session.id,
      mountId: A_REBASE_MOUNT_ID,
      sha: mode === 'conflict' ? LEDGER.a : mode === 'stash' ? LEDGER.f : LEDGER.c,
      items:
        mode === 'stash'
          ? setVerb({
              items: initialPlanItems({ commits: commitsBefore }),
              sha: LEDGER.f,
              verb: 'drop',
            })
          : mode === 'conflict'
            ? moveAbove({
                items: initialPlanItems({ commits: commitsBefore }),
                sha: LEDGER.a,
                anchor: LEDGER.f,
              })
            : rewordStep({
                items: initialPlanItems({ commits: commitsBefore }),
                sha: LEDGER.c,
                message: 'Guard the Acme export',
                original: commitsBefore[rewriteIndex]?.subject ?? '',
              }),
    });
  }, [live, mode, session]);
  if (session === null) {
    return null;
  }
  return (
    <div className="flex h-screen flex-col bg-background">
      <WorktreeSceneColumn>
        <BranchPage session={session} workingDir="/w/payments-api" />
      </WorktreeSceneColumn>
    </div>
  );
};
