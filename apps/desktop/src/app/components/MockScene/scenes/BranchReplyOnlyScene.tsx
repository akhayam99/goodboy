import { BranchSceneShell } from './BranchSceneShell';
import { THREAD_IDS, type ReplyOnlyVariant } from './resolveSeed';

type Props = {
  readonly variant: ReplyOnlyVariant;
};

export const BranchReplyOnlyScene = ({ variant }: Props) => (
  <BranchSceneShell
    width={null}
    openPush={false}
    threadId={THREAD_IDS.retryConstant}
    replyOnly={variant}
  />
);
