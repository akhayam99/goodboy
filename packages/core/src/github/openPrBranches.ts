import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, runJson } from './gh';

const OPEN_PR_BRANCH_LIMIT = 100;

type RawOpenPrBranch = {
  readonly number: number;
  readonly title: string;
  readonly headRefName: string;
  readonly isDraft: boolean;
  readonly isCrossRepository?: boolean;
  readonly author?: { readonly login?: string | null } | null;
};

export type OpenPrBranch = {
  readonly number: number;
  readonly title: string;
  readonly headBranch: string;
  readonly isDraft: boolean;
  readonly author: string | null;
};

type OpenPrBranchesParams = {
  readonly runner: GhRunner;
  readonly repoSlug: string;
  readonly opts?: GhRunOptions;
};

export const listOpenPrBranches = async ({
  runner,
  repoSlug,
  opts = {},
}: OpenPrBranchesParams): Promise<ReadonlyArray<OpenPrBranch>> => {
  try {
    const raw = await runJson<ReadonlyArray<RawOpenPrBranch>>({
      runner,
      args: [
        'pr',
        'list',
        '--repo',
        repoSlug,
        '--state',
        'open',
        '--limit',
        String(OPEN_PR_BRANCH_LIMIT),
        '--json',
        'number,title,headRefName,isDraft,isCrossRepository,author',
      ],
      opts,
      shape: 'array',
    });
    return raw
      .filter((pr) => pr.isCrossRepository !== true)
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        headBranch: pr.headRefName,
        isDraft: pr.isDraft,
        author: pr.author?.login ?? null,
      }));
  } catch (error) {
    if (error instanceof GhCliError) {
      return [];
    }
    throw error;
  }
};
