import { Suspense, lazy } from 'react';
import { SkeletonRow } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';

const Panel = lazy(() => import('./index').then((module) => ({ default: module.EveryRun })));

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const LazyEveryRun = ({ workspaceId }: Props) => (
  <Suspense fallback={<SkeletonRow label="Reading the rules for every run" />}>
    <Panel workspaceId={workspaceId} />
  </Suspense>
);
