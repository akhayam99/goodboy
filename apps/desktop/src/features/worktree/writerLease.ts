import { invoke } from '@tauri-apps/api/core';

export type WriterLeaseOutcome =
  | { readonly outcome: 'granted'; readonly token: string }
  | {
      readonly outcome: 'denied';
      readonly blockedBy: string;
      readonly blockedState: string;
      readonly blockedResource: string;
    }
  | { readonly outcome: 'unavailable' };

export type UnknownWriterLease = {
  readonly id: string;
  readonly holder: string;
  readonly runId: string | null;
  readonly resources: ReadonlyArray<string>;
  readonly createdAt: number;
};

type GrantShape = {
  readonly isGranted: boolean;
  readonly token: string | null;
  readonly blockedBy: string | null;
  readonly blockedState: string | null;
  readonly blockedResource: string | null;
};

export const repositoryWriterResource = ({ repoRoot }: { readonly repoRoot: string }): string =>
  `repo:${repoRoot}`;

export const worktreeWriterResource = ({
  repoRoot,
  worktreePath,
}: {
  readonly repoRoot: string;
  readonly worktreePath: string;
}): string => `tree:${repoRoot}|${worktreePath}`;

const isGrantShape = (value: unknown): value is GrantShape => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate: Record<string, unknown> = { ...value };
  return typeof candidate.isGranted === 'boolean';
};

const asText = (value: string | null): string => value ?? 'unknown';

type AcquireParams = {
  readonly holder: string;
  readonly resources: ReadonlyArray<string>;
  readonly runId?: string;
};

const outcomeOf = ({ raw }: { readonly raw: unknown }): WriterLeaseOutcome => {
  if (!isGrantShape(raw)) {
    return { outcome: 'unavailable' };
  }
  if (raw.isGranted && raw.token !== null) {
    return { outcome: 'granted', token: raw.token };
  }
  return {
    outcome: 'denied',
    blockedBy: asText(raw.blockedBy),
    blockedState: asText(raw.blockedState),
    blockedResource: asText(raw.blockedResource),
  };
};

export const acquireWriterLease = async ({
  holder,
  resources,
  runId,
}: AcquireParams): Promise<WriterLeaseOutcome> => {
  const raw = await invoke<unknown>('writer_lease_acquire', {
    holder,
    resources: [...resources],
    runId: runId ?? null,
  }).catch(() => null);
  return outcomeOf({ raw });
};

export const acquireWriterLeaseWaiting = async ({
  holder,
  resources,
  runId,
}: AcquireParams): Promise<WriterLeaseOutcome> => {
  const raw = await invoke<unknown>('writer_lease_acquire_waiting', {
    holder,
    resources: [...resources],
    runId: runId ?? null,
  }).catch(() => null);
  return outcomeOf({ raw });
};

export const releaseWriterLease = async ({ token }: { readonly token: string }): Promise<boolean> =>
  invoke<boolean>('writer_lease_release', { token }).catch(() => false);

export const listUnknownWriterLeases = async (): Promise<ReadonlyArray<UnknownWriterLease>> =>
  invoke<ReadonlyArray<UnknownWriterLease>>('writer_lease_unknown').catch(() => []);
