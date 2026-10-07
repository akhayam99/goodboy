import { useEffect, useState } from 'react';
import type { OpenPrBranch } from '@goodboy/core';
import { ghOpenPrBranches } from '../../integrations/github/github';
import { mergeBranchChoices, type BranchChoice } from '../branchChoices';
import {
  fetchRemoteBranches,
  getCachedLocalBranches,
  listLocalBranches,
  listRemoteBranches,
  type LocalBranchInfo,
  type RemoteBranchInfo,
} from '../worktree';

type Params = {
  readonly repoRoot: string | null;
  readonly workspaceId?: string;
  readonly projectId?: string;
};

type Result = {
  readonly choices: ReadonlyArray<BranchChoice>;
  readonly isLoading: boolean;
};

const NONE: ReadonlyArray<never> = [];

export const useBranchChoices = ({ repoRoot, workspaceId, projectId }: Params): Result => {
  const [locals, setLocals] = useState<ReadonlyArray<LocalBranchInfo>>(() =>
    repoRoot === null ? NONE : (getCachedLocalBranches(repoRoot) ?? NONE),
  );
  const [remotes, setRemotes] = useState<ReadonlyArray<RemoteBranchInfo>>(NONE);
  const [prs, setPrs] = useState<ReadonlyArray<OpenPrBranch>>(NONE);
  const [isLoading, setIsLoading] = useState(repoRoot !== null);

  useEffect(() => {
    if (repoRoot === null) {
      setIsLoading(false);
      return;
    }
    let isStale = false;
    const root = repoRoot;
    setIsLoading(true);
    const readRemotes = () =>
      listRemoteBranches(root)
        .then((result) => {
          if (!isStale) {
            setRemotes(result);
          }
        })
        .catch(() => undefined);
    const localsDone = listLocalBranches(root)
      .then((result) => {
        if (!isStale) {
          setLocals(result);
        }
      })
      .catch(() => undefined);
    const remotesDone = readRemotes();
    void remotesDone
      .then(() => fetchRemoteBranches(root))
      .then(readRemotes)
      .catch(() => undefined);
    void ghOpenPrBranches({
      cwd: root,
      ...(workspaceId === undefined ? {} : { workspaceId }),
      ...(projectId === undefined ? {} : { projectId }),
    })
      .then((result) => {
        if (!isStale) {
          setPrs(result);
        }
      })
      .catch(() => undefined);
    void Promise.all([localsDone, remotesDone]).then(() => {
      if (!isStale) {
        setIsLoading(false);
      }
    });
    return () => {
      isStale = true;
    };
  }, [repoRoot, workspaceId, projectId]);

  return { choices: mergeBranchChoices({ locals, remotes, prs }), isLoading };
};
