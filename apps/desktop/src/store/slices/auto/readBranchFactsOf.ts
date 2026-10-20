import type {
  BranchFactsCheck,
  BranchFactsCommit,
  BranchFactsPart,
  BranchFactsRequest,
  BranchFactsThread,
} from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import type { BranchFactsParts, ReadBranchFactsParams } from './ports';

export type RequestFacts = Readonly<{
  request: BranchFactsRequest;
  checks: BranchFactsPart<ReadonlyArray<BranchFactsCheck>>;
}>;

type ThreadsOfParams = Readonly<{
  params: ReadBranchFactsParams;
  request: BranchFactsRequest;
}>;

export type BranchFactsReaders = Readonly<{
  commits: (params: ReadBranchFactsParams) => Promise<ReadonlyArray<BranchFactsCommit>>;
  request: (params: ReadBranchFactsParams) => Promise<RequestFacts | null>;
  threads: (params: ThreadsOfParams) => Promise<ReadonlyArray<BranchFactsThread>>;
}>;

type Params = {
  readonly readers: BranchFactsReaders;
  readonly params: ReadBranchFactsParams;
};

type SettleParams<Value> = {
  readonly read: () => Promise<Value>;
};

const settle = async <Value>({ read }: SettleParams<Value>): Promise<BranchFactsPart<Value>> => {
  try {
    return { kind: 'ok', value: await read() };
  } catch (error) {
    return { kind: 'unavailable', reason: formatError(error) };
  }
};

const NO_REQUEST = 'no request is open for this branch';

export const readBranchFactsOf = async ({ readers, params }: Params): Promise<BranchFactsParts> => {
  const [commits, request] = await Promise.all([
    settle({ read: () => readers.commits(params) }),
    settle({ read: () => readers.request(params) }),
  ]);
  if (request.kind === 'unavailable') {
    return {
      commits,
      request,
      threads: { kind: 'unavailable', reason: request.reason },
      checks: { kind: 'unavailable', reason: request.reason },
    };
  }
  if (request.value === null) {
    return {
      commits,
      request: { kind: 'ok', value: null },
      threads: { kind: 'unavailable', reason: NO_REQUEST },
      checks: { kind: 'unavailable', reason: NO_REQUEST },
    };
  }
  const found = request.value;
  const threads = await settle({ read: () => readers.threads({ params, request: found.request }) });
  return { commits, request: { kind: 'ok', value: found.request }, threads, checks: found.checks };
};
