import { Eyebrow } from '@goodboy/ui';
import { LevelSkeleton } from '../../../SessionRail/SessionLevel/LevelSkeleton';
import { SessionOverviewSkeleton } from '../../../../../features/session/components/SessionWorkspace/parts/SessionOverviewSkeleton';
import { ColumnSkeleton } from '../../../../../features/workspace/components/StageBoard/StageColumn/ColumnSkeleton';

export const U34_T33_SCENES = {
  'u34-t33-overview-loading': () => (
    <div className="h-screen w-full bg-background">
      <SessionOverviewSkeleton isFreshLayout={false} />
    </div>
  ),
  'u34-t34-column-loading': () => (
    <div className="h-screen w-full bg-background p-6">
      <div className="flex w-72 flex-col gap-6">
        <LevelSkeleton />
        <div className="flex flex-col gap-2">
          <Eyebrow label="Archived" />
          <ColumnSkeleton label="Loading sessions" />
        </div>
      </div>
    </div>
  ),
};
