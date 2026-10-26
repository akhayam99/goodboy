import {
  AUTO_FACTS_FETCH_MS,
  type BranchFacts,
  type BranchFactsPart,
  type PickableMount,
} from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import type { AutoPorts, BranchFactsParts } from './ports';

export type MountLabelParams = {
  readonly mount: PickableMount;
};

export const mountLabelOf = ({ mount }: MountLabelParams): string =>
  `${mount.id} (${mount.mountName ?? 'unnamed'}, branch ${mount.branch})`;

export type GatherBranchFactsParams = Readonly<{
  ports: Pick<AutoPorts, 'readBranchFacts'>;
  sessionId: SessionId;
  mounts: ReadonlyArray<PickableMount>;
  mountIds: ReadonlyArray<string>;
  timeoutMs?: number;
}>;

export type GatheredBranchFacts =
  | Readonly<{ kind: 'ok'; facts: ReadonlyArray<BranchFacts> }>
  | Readonly<{ kind: 'unknown_mount'; mountId: string }>;

type WholeParams = {
  readonly reason: string;
};

const unavailableOf = ({ reason }: WholeParams): BranchFactsParts => {
  const part: BranchFactsPart<never> = { kind: 'unavailable', reason };
  return { commits: part, request: part, threads: part, checks: part };
};

type TimedParams = {
  readonly read: Promise<BranchFactsParts>;
  readonly timeoutMs: number;
};

const timed = ({ read, timeoutMs }: TimedParams): Promise<BranchFactsParts> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(unavailableOf({ reason: `the host took longer than ${timeoutMs / 1000} s` }));
    }, timeoutMs);
    read.then(
      (parts) => {
        clearTimeout(timer);
        resolve(parts);
      },
      (error: unknown) => {
        clearTimeout(timer);
        resolve(unavailableOf({ reason: error instanceof Error ? error.message : 'read failed' }));
      },
    );
  });

export const gatherBranchFacts = async ({
  ports,
  sessionId,
  mounts,
  mountIds,
  timeoutMs = AUTO_FACTS_FETCH_MS,
}: GatherBranchFactsParams): Promise<GatheredBranchFacts> => {
  const picked: PickableMount[] = [];
  for (const mountId of mountIds) {
    const mount = mounts.find((candidate) => candidate.id === mountId);
    if (mount === undefined) {
      return { kind: 'unknown_mount', mountId };
    }
    picked.push(mount);
  }
  const facts = await Promise.all(
    picked.map(async (mount) => ({
      mountLabel: mountLabelOf({ mount }),
      ...(mount.worktreePath === null
        ? unavailableOf({ reason: 'this mount has no folder on disk' })
        : await timed({
            read: ports.readBranchFacts({
              sessionId,
              mountId: mount.id,
              worktreePath: mount.worktreePath,
              branch: mount.branch,
            }),
            timeoutMs,
          })),
    })),
  );
  return { kind: 'ok', facts };
};
