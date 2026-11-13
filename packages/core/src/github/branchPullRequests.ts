import type { PullRequestState } from '@goodboy/types';
import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, GhJsonParseError, runJson } from './gh';
import { toPullRequestState, type RawPullRequest } from './resolver';

const BRANCH_BATCH_SIZE = 20;

const PER_BRANCH_LIMIT = 20;

type RawContext = {
  readonly status?: string | null;
  readonly conclusion?: string | null;
  readonly state?: string | null;
};

type RawBranchNode = {
  readonly number: number;
  readonly title: string;
  readonly url: string;
  readonly state: RawPullRequest['state'];
  readonly isDraft: boolean;
  readonly mergeable: RawPullRequest['mergeable'];
  readonly baseRefName: string;
  readonly headRefName: string;
  readonly reviewDecision: RawPullRequest['reviewDecision'];
  readonly updatedAt: string;
  readonly body: string | null;
  readonly autoMergeRequest: Record<string, unknown> | null;
  readonly headRefOid?: string | null;
  readonly mergedAt?: string | null;
  readonly author?: {
    readonly login?: string | null;
    readonly avatarUrl?: string | null;
  } | null;
  readonly reviewRequests?: { readonly totalCount?: number | null } | null;
  readonly isInMergeQueue?: boolean | null;
  readonly mergeQueueEntry?: { readonly position?: number | null } | null;
  readonly commits?: {
    readonly nodes?: ReadonlyArray<{
      readonly commit?: {
        readonly statusCheckRollup?: {
          readonly contexts?: { readonly nodes?: ReadonlyArray<RawContext | null> | null } | null;
        } | null;
      } | null;
    } | null> | null;
  } | null;
};

type RawBranchResponse = {
  readonly data?: {
    readonly repository?: Record<
      string,
      { readonly nodes?: ReadonlyArray<RawBranchNode | null> | null } | null
    > | null;
  } | null;
};

const NODE_FIELDS = `number title url state isDraft mergeable baseRefName headRefName reviewDecision updatedAt body
  autoMergeRequest{ enabledAt } headRefOid mergedAt author{ login avatarUrl } reviewRequests(first:1){ totalCount }
  isInMergeQueue mergeQueueEntry{ position state }
  commits(last:1){ nodes{ commit{ statusCheckRollup{ contexts(first:100){ nodes{
    __typename ... on CheckRun{ status conclusion } ... on StatusContext{ state } } } } } } }`;

type AliasParams = { readonly index: number };

type QueryParams = { readonly count: number };

const aliasOf = ({ index }: AliasParams): string => `b${index}`;

const queryOf = ({ count }: QueryParams): string => {
  const variables = Array.from({ length: count }, (_, index) => `$${aliasOf({ index })}:String!`);
  const fields = Array.from(
    { length: count },
    (_, index) =>
      `${aliasOf({ index })}: pullRequests(first:${PER_BRANCH_LIMIT},headRefName:$${aliasOf({ index })},states:[OPEN,CLOSED,MERGED],orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{ ${NODE_FIELDS} } }`,
  );
  return `query($owner:String!,$name:String!,${variables.join(',')}){ repository(owner:$owner,name:$name){ ${fields.join(' ')} } }`;
};

type NodeParams = { readonly node: RawBranchNode };

type NodesParams = { readonly nodes: ReadonlyArray<RawBranchNode | null> };

const toRaw = ({ node }: NodeParams): RawPullRequest => {
  const contexts = node.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];
  return {
    number: node.number,
    title: node.title,
    url: node.url,
    state: node.state,
    isDraft: node.isDraft,
    mergeable: node.mergeable,
    baseRefName: node.baseRefName,
    headRefName: node.headRefName,
    reviewDecision: node.reviewDecision,
    statusCheckRollup: contexts.flatMap((context) =>
      context === null
        ? []
        : [{ state: context.state, status: context.status, conclusion: context.conclusion }],
    ),
    updatedAt: node.updatedAt,
    body: node.body,
    autoMergeRequest: node.autoMergeRequest,
    headRefOid: node.headRefOid,
    mergedAt: node.mergedAt,
    author: node.author,
    reviewRequests: Array.from({ length: node.reviewRequests?.totalCount ?? 0 }),
  };
};

const toStates = ({ nodes }: NodesParams): ReadonlyArray<PullRequestState> =>
  nodes
    .flatMap((node) => (node === null ? [] : [node]))
    .sort((a, b) => {
      const aTerminal = a.state === 'OPEN' ? 0 : 1;
      const bTerminal = b.state === 'OPEN' ? 0 : 1;
      if (aTerminal !== bTerminal) {
        return aTerminal - bTerminal;
      }
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .map((node) =>
      toPullRequestState({
        raw: toRaw({ node }),
        mergeQueue:
          node.mergeQueueEntry != null || node.isInMergeQueue === true
            ? { position: node.mergeQueueEntry?.position ?? null }
            : null,
      }),
    );

type ChunkParams = {
  readonly runner: GhRunner;
  readonly owner: string;
  readonly name: string;
  readonly branches: ReadonlyArray<string>;
  readonly opts: GhRunOptions;
};

const listChunk = async ({
  runner,
  owner,
  name,
  branches,
  opts,
}: ChunkParams): Promise<ReadonlyMap<string, ReadonlyArray<PullRequestState>> | null> => {
  const args = [
    'api',
    'graphql',
    '-f',
    `query=${queryOf({ count: branches.length })}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `name=${name}`,
    ...branches.flatMap((branch, index) => ['-f', `${aliasOf({ index })}=${branch}`]),
  ];
  try {
    const raw = await runJson<RawBranchResponse>({ runner, args, opts, shape: 'object' });
    const repository = raw.data?.repository;
    if (repository == null) {
      return null;
    }
    const byBranch = new Map<string, ReadonlyArray<PullRequestState>>();
    branches.forEach((branch, index) => {
      const nodes = repository[aliasOf({ index })]?.nodes ?? [];
      byBranch.set(branch, toStates({ nodes }));
    });
    return byBranch;
  } catch (err) {
    if (err instanceof GhCliError || err instanceof GhJsonParseError) {
      return null;
    }
    throw err;
  }
};

type ListPrsForBranchesParams = {
  readonly runner: GhRunner;
  readonly repo: string;
  readonly branches: ReadonlyArray<string>;
  readonly opts?: GhRunOptions;
};

export const listPrsForBranches = async ({
  runner,
  repo,
  branches,
  opts = {},
}: ListPrsForBranchesParams): Promise<ReadonlyMap<
  string,
  ReadonlyArray<PullRequestState>
> | null> => {
  const [owner, name] = repo.split('/');
  const unique = [...new Set(branches)];
  if (owner == null || owner === '' || name == null || name === '' || unique.length === 0) {
    return null;
  }
  const merged = new Map<string, ReadonlyArray<PullRequestState>>();
  for (let start = 0; start < unique.length; start += BRANCH_BATCH_SIZE) {
    const chunk = await listChunk({
      runner,
      owner,
      name,
      branches: unique.slice(start, start + BRANCH_BATCH_SIZE),
      opts,
    });
    if (chunk === null) {
      return null;
    }
    for (const [branch, states] of chunk) {
      merged.set(branch, states);
    }
  }
  return merged;
};
