import { CircleAlert, GitMerge, X } from 'lucide-react';
import { cn, GhostActionButton, ICON_SIZE, IconButton, tintClasses } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { PushFailureBlock } from '../../../../shared/components/PushFailureBlock';
import { PushFixAgentAction } from '../../../../shared/components/PushFixAgentAction';
import { SYNC_COPY } from '../../failedRunCopy';
import type { PushResult } from '../../reviewPushCopy';
import type { ReviewPush } from './useReviewPush';

type Props = {
  readonly sessionId: SessionId;
  readonly push: ReviewPush;
  readonly result: PushResult;
};

const DISMISS_LABEL = 'Dismiss';

export const PushFailureCard = ({ sessionId, push, result }: Props) => {
  const { fixTarget } = push;
  const output = result.failure?.output ?? '';
  return (
    <div
      role="alert"
      className="flex min-w-0 flex-col gap-2 rounded-lg bg-subtle px-4 py-2 text-meta text-foreground"
    >
      <div className="flex min-w-0 items-center gap-2">
        <CircleAlert
          size={ICON_SIZE.control}
          aria-hidden
          className={cn('shrink-0', tintClasses('danger').icon)}
        />
        <span className="min-w-0 flex-1">{result.sentence}</span>
        <IconButton icon={X} label={DISMISS_LABEL} variant="ghost" onClick={push.dismiss} />
      </div>
      <PushFailureBlock output={output} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {result.canSync === true && (
          <GhostActionButton icon={GitMerge} label={SYNC_COPY.action} onClick={push.askSync} />
        )}
        {fixTarget !== null && (
          <PushFixAgentAction
            sessionId={sessionId}
            mountId={fixTarget.mountId}
            output={output}
            {...(fixTarget.pending !== undefined && { pending: fixTarget.pending })}
            onSettled={push.retryAfterFix}
          />
        )}
      </div>
    </div>
  );
};
