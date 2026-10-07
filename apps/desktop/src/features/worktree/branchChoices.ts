import type { OpenPrBranch } from '@goodboy/core';
import type { LocalBranchInfo, RemoteBranchInfo } from './worktree';

export type BranchChoiceSource = 'local' | 'remote' | 'pr';

export type BranchChoice = LocalBranchInfo & {
  readonly source: BranchChoiceSource;
  readonly author: string | null;
  readonly prNumber: number | null;
  readonly isDraft: boolean;
  readonly title: string | null;
};

type MergeParams = {
  readonly locals: ReadonlyArray<LocalBranchInfo>;
  readonly remotes: ReadonlyArray<RemoteBranchInfo>;
  readonly prs: ReadonlyArray<OpenPrBranch>;
};

export const mergeBranchChoices = ({
  locals,
  remotes,
  prs,
}: MergeParams): ReadonlyArray<BranchChoice> => {
  const prByBranch = new Map(prs.map((pr) => [pr.headBranch, pr]));
  const remoteByName = new Map(remotes.map((remote) => [remote.name, remote]));
  const decorate = (name: string) => {
    const pr = prByBranch.get(name);
    return {
      author: pr?.author ?? remoteByName.get(name)?.author ?? null,
      prNumber: pr?.number ?? null,
      isDraft: pr?.isDraft ?? false,
      title: pr?.title ?? null,
    };
  };
  const localNames = new Set(locals.map((local) => local.name));
  const localChoices = locals.map((local): BranchChoice => ({
    ...local,
    source: 'local',
    ...decorate(local.name),
  }));
  const remoteChoices = remotes
    .filter((remote) => !localNames.has(remote.name) && !prByBranch.has(remote.name))
    .map((remote): BranchChoice => ({
      name: remote.name,
      inUse: false,
      hasUncommitted: false,
      source: 'remote',
      ...decorate(remote.name),
    }));
  const prChoices = prs
    .filter((pr) => !localNames.has(pr.headBranch))
    .map((pr): BranchChoice => ({
      name: pr.headBranch,
      inUse: false,
      hasUncommitted: false,
      source: 'pr',
      ...decorate(pr.headBranch),
    }));
  const seen = new Set<string>();
  return [...localChoices, ...prChoices, ...remoteChoices].filter((choice) => {
    if (seen.has(choice.name)) {
      return false;
    }
    seen.add(choice.name);
    return true;
  });
};

type DescribeParams = {
  readonly choice: Pick<BranchChoice, 'author' | 'prNumber' | 'isDraft'>;
};

export const branchChoiceOrigin = ({ choice }: DescribeParams): string | null => {
  const parts = [
    choice.prNumber === null ? null : `${choice.isDraft ? 'Draft ' : ''}PR #${choice.prNumber}`,
    choice.author,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' · ');
};

export const branchChoiceGroup = ({ source }: { readonly source: BranchChoiceSource }): string => {
  if (source === 'local') {
    return 'On this Mac';
  }
  return source === 'pr' ? 'Open pull requests' : 'On origin';
};
