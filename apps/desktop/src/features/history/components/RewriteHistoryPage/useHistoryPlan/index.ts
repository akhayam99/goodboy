import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { BranchCommit, HistoryStep, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useWorktreeStatuses } from '../../../../session/hooks/useWorktreeStatuses';
import {
  selectMountBaseBranch,
  selectMountForPath,
} from '../../../../../store/slices/project-mounts/selectors';
import { isHistoryRunActive } from '../../../../../store/slices/history/isHistoryRunActive';
import { deriveHistoryEdits } from '../../../historyEdits';
import { historyGraphModel } from '../../../historyGraphModel';
import { historyRowMarks } from '../../../historyRowMarks';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
};

const EMPTY_ITEMS: ReadonlyArray<HistoryStep> = [];
const EMPTY_COMMITS: ReadonlyArray<BranchCommit> = [];

export const useHistoryPlan = ({ sessionId, worktreePath }: Params) => {
  const mount = useAppStore(
    useShallow((s) => selectMountForPath({ state: s, sessionId, path: worktreePath })),
  );
  const mountId = mount?.mountId ?? null;
  const draft = useAppStore((s) => (mountId === null ? null : (s.historyDrafts[mountId] ?? null)));
  const run = useAppStore((s) => (mountId === null ? null : (s.historyRuns[mountId] ?? null)));
  const prNumber = useAppStore((s) =>
    mountId === null ? null : (s.mountGithub[mountId]?.pr?.number ?? null),
  );
  const prHeadSha = useAppStore((s) =>
    mountId === null ? null : (s.mountGithub[mountId]?.pr?.headSha ?? null),
  );
  const loadHistoryDraft = useAppStore((s) => s.loadHistoryDraft);

  useEffect(() => {
    if (mountId === null) {
      return;
    }
    void loadHistoryDraft({ sessionId, mountId });
  }, [loadHistoryDraft, mountId, sessionId]);

  const items = draft?.items ?? EMPTY_ITEMS;
  const commits = draft?.commits ?? EMPTY_COMMITS;
  const onto = draft?.onto ?? null;
  const graph = draft?.graph ?? null;
  const original = useMemo(() => [...commits].reverse().map((commit) => commit.sha), [commits]);
  const commitBySha = useMemo(
    () => new Map(commits.map((commit) => [commit.sha, commit])),
    [commits],
  );
  const titleOf = (sha: string): string => commitBySha.get(sha)?.subject ?? sha.slice(0, 7);
  const marks = useMemo(() => historyRowMarks({ items, original }), [items, original]);
  const edits = useMemo(
    () => deriveHistoryEdits({ items, original, onto, behind: graph?.behind ?? 0 }),
    [graph?.behind, items, onto, original],
  );
  const model = historyGraphModel({ commits, items, original, onto, graph, prHeadSha });
  const chosenBase = useAppStore((s) =>
    selectMountBaseBranch({ state: s, sessionId, path: worktreePath }),
  );
  const statusTargets = useMemo(
    () => [{ worktreePath, baseBranch: chosenBase ?? undefined }],
    [chosenBase, worktreePath],
  );
  const status = useWorktreeStatuses({ targets: statusTargets }).get(worktreePath) ?? null;
  const hasUpstream =
    status !== null ? status.upstream !== null || graph?.remoteSha != null : model.onlineCount > 0;
  const dirtyCount =
    status === null || status.workingTree.kind !== 'known'
      ? 0
      : status.workingTree.staged + status.workingTree.unstaged + status.workingTree.unmerged;
  const isBusy = run !== null && isHistoryRunActive({ phase: run.phase });
  const applied = run !== null && run.phase !== 'restored' ? run.applied : null;
  const isDone = applied !== null;
  const isInteractive = draft !== null && !isBusy && !isDone && commits.length > 0;

  return {
    mount,
    mountId,
    draft,
    run,
    prNumber,
    items,
    commits,
    onto,
    graph,
    original,
    commitBySha,
    titleOf,
    marks,
    edits,
    model,
    chosenBase,
    status,
    hasUpstream,
    dirtyCount,
    isBusy,
    applied,
    isDone,
    isInteractive,
  };
};
