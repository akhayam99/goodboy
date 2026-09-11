import type { ProjectId } from '@goodboy/types';
import type { PrLifecycleAction } from '../../../features/review/prLifecycle';
import type { PrWriteAnnouncement } from '../../../features/review/prWriteBus';
import type { PrWritesState } from './state';

export type { GetFn, SetFn } from '../../slice-types';

export type PrWriteClaim = {
  readonly key: string;
  readonly windowLabel: string;
  readonly action: PrLifecycleAction;
  readonly startedAt: number;
};

export type PrWriteTarget = {
  readonly projectId: ProjectId;
  readonly prNumber: number;
};

export type ClaimPrWriteParams = PrWriteTarget & {
  readonly action: PrLifecycleAction;
};

export type PrWriteClaimResult =
  { readonly ok: true } | { readonly ok: false; readonly claim: PrWriteClaim };

export type PrWritesSlice = PrWritesState & {
  claimPrWrite(params: ClaimPrWriteParams): PrWriteClaimResult;
  releasePrWrite(params: PrWriteTarget): void;
  notePrWrite(announcement: PrWriteAnnouncement): void;
  sweepPrWriteClaims(): void;
};
