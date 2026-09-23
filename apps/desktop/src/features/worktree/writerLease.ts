import { invoke } from '@tauri-apps/api/core';
import { formatError } from '@goodboy/ui';

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

export const acquireWriterLease = async ({
  holder,
  resources,
  runId,
}: {
  readonly holder: string;
  readonly resources: ReadonlyArray<string>;
  readonly runId?: string;
}): Promise<WriterLeaseOutcome> => {
  const raw = await invoke<unknown>('writer_lease_acquire', {
    holder,
    resources: [...resources],
    runId: runId ?? null,
  }).catch(() => null);
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

export type ApplicationWriterLease =
  | { readonly outcome: 'granted'; readonly leaseId: string; readonly token: string }
  | {
      readonly outcome: 'denied';
      readonly blockedBy: string;
      readonly blockedState: string;
      readonly blockedResource: string;
    }
  | { readonly outcome: 'refused'; readonly reason: string };

type GrantWithIdShape = GrantShape & {
  readonly id: string | null;
};

const isGrantWithIdShape = (value: unknown): value is GrantWithIdShape => {
  if (!isGrantShape(value)) {
    return false;
  }
  const candidate: Record<string, unknown> = { ...value };
  return candidate.id === null || typeof candidate.id === 'string';
};

type ToApplicationLeaseParams = {
  readonly raw: unknown;
};

const toApplicationLease = ({ raw }: ToApplicationLeaseParams): ApplicationWriterLease => {
  if (!isGrantWithIdShape(raw)) {
    return { outcome: 'refused', reason: 'the writer lease ledger did not answer' };
  }
  if (raw.isGranted && raw.token !== null && raw.id !== null) {
    return { outcome: 'granted', leaseId: raw.id, token: raw.token };
  }
  return {
    outcome: 'denied',
    blockedBy: asText(raw.blockedBy),
    blockedState: asText(raw.blockedState),
    blockedResource: asText(raw.blockedResource),
  };
};

const refusalOf = (error: unknown): ApplicationWriterLease => ({
  outcome: 'refused',
  reason: formatError(error),
});

type AcquireApplicationWriterLeaseParams = {
  readonly holder: string;
  readonly resources: ReadonlyArray<string>;
};

export const acquireApplicationWriterLease = async ({
  holder,
  resources,
}: AcquireApplicationWriterLeaseParams): Promise<ApplicationWriterLease> =>
  invoke<unknown>('writer_lease_acquire_application', { holder, resources: [...resources] }).then(
    (raw) => toApplicationLease({ raw }),
    refusalOf,
  );

export type OwnedReservation = {
  readonly leaseId: string;
  readonly token: string;
};

type AcquireOwnedWriterLeaseParams = {
  readonly holder: string;
  readonly resources: ReadonlyArray<string>;
  readonly owners: ReadonlyArray<OwnedReservation>;
  readonly runId?: string;
};

export const acquireOwnedWriterLease = async ({
  holder,
  resources,
  owners,
  runId,
}: AcquireOwnedWriterLeaseParams): Promise<ApplicationWriterLease> =>
  invoke<unknown>('writer_lease_acquire_owned', {
    holder,
    resources: [...resources],
    owners: owners.map((owner) => ({ leaseId: owner.leaseId, token: owner.token })),
    runId: runId ?? null,
  }).then((raw) => toApplicationLease({ raw }), refusalOf);

export const releaseWriterLease = async ({ token }: { readonly token: string }): Promise<boolean> =>
  invoke<boolean>('writer_lease_release', { token }).catch(() => false);

export const listUnknownWriterLeases = async (): Promise<ReadonlyArray<UnknownWriterLease>> =>
  invoke<ReadonlyArray<UnknownWriterLease>>('writer_lease_unknown').catch(() => []);

export type UnknownWriterLeaseRelease =
  | { readonly kind: 'released'; readonly id: string; readonly holder: string }
  | { readonly kind: 'not-found'; readonly id: string }
  | { readonly kind: 'not-stranded'; readonly id: string; readonly state: string }
  | { readonly kind: 'owner-alive'; readonly id: string; readonly processId: number }
  | { readonly kind: 'evidence-missing'; readonly id: string }
  | { readonly kind: 'unavailable'; readonly id: string };

const RELEASE_KINDS: ReadonlyArray<UnknownWriterLeaseRelease['kind']> = [
  'released',
  'not-found',
  'not-stranded',
  'owner-alive',
  'evidence-missing',
];

const isReleaseShape = (value: unknown): value is UnknownWriterLeaseRelease => {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate: Record<string, unknown> = { ...value };
  return RELEASE_KINDS.some((kind) => kind === candidate.kind);
};

export const releaseUnknownWriterLease = async ({
  leaseId,
  releasedBy,
  evidence,
}: {
  readonly leaseId: string;
  readonly releasedBy: string;
  readonly evidence: string;
}): Promise<UnknownWriterLeaseRelease> => {
  const raw = await invoke<unknown>('writer_lease_release_unknown', {
    leaseId,
    releasedBy,
    evidence,
  }).catch(() => null);
  if (!isReleaseShape(raw)) {
    return { kind: 'unavailable', id: leaseId };
  }
  return raw;
};
