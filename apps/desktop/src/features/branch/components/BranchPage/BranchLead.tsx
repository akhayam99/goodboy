import type { ComponentProps } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { JobBanner } from '../../../history/JobBanner';
import { PushBanner } from '../../../resolve/components/ReviewFlow/PushBanner';

type Props = {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly worktreePath: string | null;
  readonly push: ComponentProps<typeof PushBanner>['push'];
};

export const BranchLead = ({ sessionId, mountId, worktreePath, push }: Props) => (
  <>
    <PushBanner sessionId={sessionId} mountId={mountId} push={push} />
    <JobBanner sessionId={sessionId} worktreePath={worktreePath} />
  </>
);
