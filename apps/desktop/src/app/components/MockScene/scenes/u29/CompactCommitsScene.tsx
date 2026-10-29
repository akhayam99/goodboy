import { useEffect, useState } from 'react';
import { CommitsHistory } from '../../../../../features/history/components/CommitsHistory';
import { seedLiveHistory } from '../../../../../features/history/testing/seedLiveHistory';
import {
  LEDGER_COMMITS,
  LEDGER_GRAPH,
} from '../../../../../features/history/testing/ledgerFixture';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { mockSceneIpc } from '../mockSceneIpc';
import { PageSheet } from '../PageSheet';

const CLOCK = sceneClock({ anchor: '2026-10-29T12:00:00Z' });
const COMMITS = LEDGER_COMMITS.map((commit, index) => ({
  ...commit,
  author: index % 2 === 0 ? 'Harborline' : 'Northwind',
  timestamp: Math.floor(CLOCK.ms({ at: '2026-10-29T12:00:00Z' }) / 1000) - index * 18 * 3600,
}));

export const CompactCommitsScene = () => {
  const [target, setTarget] = useState<ReturnType<typeof seedLiveHistory> | null>(null);
  useEffect(() => {
    const graph = {
      ...LEDGER_GRAPH,
      mergeBase: {
        ...LEDGER_GRAPH.mergeBase,
        timestamp: (COMMITS[COMMITS.length - 1]?.timestamp ?? 0) - 18 * 3600,
      },
      mainCommits: LEDGER_GRAPH.mainCommits.map((commit, index) => ({
        ...commit,
        timestamp: (COMMITS[0]?.timestamp ?? 0) - (index + 1) * 3600,
      })),
      configuredAuthor:
        new URLSearchParams(window.location.search).get('identity') === 'unknown'
          ? null
          : 'Harborline',
    };
    mockSceneIpc((command) => {
      if (command === 'worktree_commits') {
        return COMMITS;
      }
      if (command === 'history_graph') {
        return graph;
      }
      if (command === 'worktree_status') {
        return {
          branch: 'hl/ledger-export',
          head: COMMITS[0]?.sha ?? '',
          upstream: 'origin/hl/ledger-export',
          workingTree: {
            kind: 'known',
            staged: 0,
            unstaged: 0,
            untracked: 0,
            unmerged: 0,
            changed: 0,
          },
          upstreamDistance: {
            kind: 'known',
            ahead: COMMITS.filter((commit) => !commit.pushed).length,
            behind: 0,
          },
          mainDistance: { kind: 'known', ahead: COMMITS.length, behind: 0 },
        };
      }
      if (command === 'history_backups_list' || command === 'worktree_list_branch_names') {
        return [];
      }
      return null;
    });
    const seeded = seedLiveHistory({ store: useAppStore });
    const draft = useAppStore.getState().historyDrafts[seeded.mount.mountId];
    if (draft === undefined) {
      return;
    }
    useAppStore.setState({
      historyDrafts: { [seeded.mount.mountId]: { ...draft, commits: COMMITS, graph } },
    });
    setTarget(seeded);
  }, []);
  if (target === null) {
    return null;
  }
  return (
    <main data-shot className="flex h-screen bg-background text-foreground">
      <PageSheet>
        <CommitsHistory
          sessionId={target.mount.sessionId}
          worktreePath={target.mount.worktreePath}
        />
      </PageSheet>
    </main>
  );
};
