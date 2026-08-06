import type { GhRunner, GhRunOptions } from './gh';
import { GhCliError, GhJsonParseError, runJson } from './gh';

export type MergeQueuePlacement = {
  readonly position: number | null;
};

type RawMergeQueueNode = {
  number: number;
  isInMergeQueue?: boolean | null;
  mergeQueueEntry?: { position?: number | null; state?: string | null } | null;
};

type RawMergeQueueResponse = {
  data?: {
    repository?: {
      pullRequests?: { nodes?: ReadonlyArray<RawMergeQueueNode> | null } | null;
    } | null;
  } | null;
};

const BRANCH_MERGE_QUEUE_QUERY = `query($owner:String!,$name:String!,$branch:String!){
  repository(owner:$owner,name:$name){
    pullRequests(first:20,states:[OPEN],headRefName:$branch){
      nodes{ number isInMergeQueue mergeQueueEntry{ position state } }
    }
  }
}`;

const REPO_MERGE_QUEUE_QUERY = `query($owner:String!,$name:String!){
  repository(owner:$owner,name:$name){
    pullRequests(first:100,states:[OPEN],orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes{ number isInMergeQueue mergeQueueEntry{ position state } }
    }
  }
}`;

const EMPTY_PLACEMENTS: ReadonlyMap<number, MergeQueuePlacement> = new Map();

const toPlacements = ({
  nodes,
}: {
  nodes: ReadonlyArray<RawMergeQueueNode>;
}): ReadonlyMap<number, MergeQueuePlacement> => {
  const placements = new Map<number, MergeQueuePlacement>();
  for (const node of nodes) {
    const entry = node.mergeQueueEntry;
    if (entry == null && node.isInMergeQueue !== true) {
      continue;
    }
    placements.set(node.number, { position: entry?.position ?? null });
  }
  return placements;
};

const buildArgs = ({
  owner,
  name,
  branch,
}: {
  owner: string;
  name: string;
  branch: string | null;
}): ReadonlyArray<string> => {
  if (branch == null) {
    return [
      'api',
      'graphql',
      '-f',
      `query=${REPO_MERGE_QUEUE_QUERY}`,
      '-f',
      `owner=${owner}`,
      '-f',
      `name=${name}`,
    ];
  }
  return [
    'api',
    'graphql',
    '-f',
    `query=${BRANCH_MERGE_QUEUE_QUERY}`,
    '-f',
    `owner=${owner}`,
    '-f',
    `name=${name}`,
    '-f',
    `branch=${branch}`,
  ];
};

export const fetchMergeQueuePlacements = async ({
  runner,
  repo,
  branch,
  opts = {},
}: {
  runner: GhRunner;
  repo: string;
  branch: string | null;
  opts?: GhRunOptions;
}): Promise<ReadonlyMap<number, MergeQueuePlacement>> => {
  const [owner, name] = repo.split('/');
  if (owner == null || owner === '' || name == null || name === '') {
    return EMPTY_PLACEMENTS;
  }
  try {
    const raw = await runJson<RawMergeQueueResponse>(
      runner,
      buildArgs({ owner, name, branch }),
      opts,
    );
    return toPlacements({ nodes: raw.data?.repository?.pullRequests?.nodes ?? [] });
  } catch (err) {
    if (err instanceof GhCliError || err instanceof GhJsonParseError) {
      return EMPTY_PLACEMENTS;
    }
    throw err;
  }
};
