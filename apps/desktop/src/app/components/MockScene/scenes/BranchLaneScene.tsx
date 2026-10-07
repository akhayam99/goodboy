import { BranchSceneShell } from './BranchSceneShell';
import type { ResolveLaneVariant } from './resolveLaneSeed';
import { THREAD_IDS } from './resolveSeed';

type Props = {
  readonly variant: ResolveLaneVariant;
};

export const BranchLaneScene = ({ variant }: Props) => (
  <BranchSceneShell
    width={null}
    openPush={false}
    threadId={variant === 'chain' ? THREAD_IDS.retryConstant : THREAD_IDS.typo}
    lane={variant}
  />
);
