import type { ReactNode } from 'react';
import type { MountId, Session } from '@goodboy/types';
import type { BranchWorkCounts } from './branchTabFactsOf';

export type BranchWorkParams = {
  readonly session: Session;
  readonly mountId: MountId | null;
  readonly mountPath: string | null;
};

export type BranchWork<View> = Readonly<{
  counts: BranchWorkCounts | null;
  isLoaded: boolean;
  view: View;
}>;

type RenderParams<View> = {
  readonly session: Session;
  readonly work: BranchWork<View>;
};

export type BranchWorkTabRegistration<View> = Readonly<{
  useWork: (params: BranchWorkParams) => BranchWork<View>;
  render: (params: RenderParams<View>) => ReactNode;
}>;
