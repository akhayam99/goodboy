import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { CountToggle } from '@goodboy/ui';
import type { PrComment, ResolvePublicationPreview } from '@goodboy/types';
import { resolveStepPlan } from '../../../../store/slices/resolve/resolveStepPlan';
import { excludedLine, heldBackNote, publicationCountsLine } from '../../resolvePublishCopy';
import { RESOLVE_PUBLISH_REPLIES_LABEL, RESOLVE_REPLY_PLAN } from '../../resolveQueueCopy';

type Props = {
  readonly preview: ResolvePublicationPreview;
  readonly comments: ReadonlyArray<PrComment>;
  readonly resolveOnGithub: boolean;
};

export const PublishLines = ({ preview, comments, resolveOnGithub }: Props) => {
  const [areRepliesShown, setAreRepliesShown] = useState(false);
  const counts = publicationCountsLine({ preview });
  const held = heldBackNote({ preview });
  const excluded = excludedLine({ preview });
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {counts !== null && (
        <p className="text-2xs tabular-nums text-foreground">
          {counts}
          {held !== null && <span className="text-warning">{` · ${held}`}</span>}
        </p>
      )}
      {counts === null && held !== null && <p className="text-2xs text-warning">{held}</p>}
      {counts === null && excluded !== null && (
        <p className="text-2xs text-muted-foreground">{excluded}</p>
      )}
      {preview.replies.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center">
            <CountToggle
              label={RESOLVE_PUBLISH_REPLIES_LABEL}
              count={preview.replies.length}
              isShown={areRepliesShown}
              icon={MessageSquare}
              onChange={setAreRepliesShown}
            />
          </div>
          {areRepliesShown && (
            <ul className="flex flex-col gap-2">
              {preview.replies.map((reply) => (
                <li key={reply.threadId} className="flex min-w-0 flex-col gap-1">
                  <span className="text-3xs text-muted-foreground">
                    {reply.closes &&
                    resolveStepPlan({
                      threadId: reply.threadId,
                      comments,
                      shouldResolveOnGithub: resolveOnGithub,
                    }) === 'resolve'
                      ? RESOLVE_REPLY_PLAN.resolves
                      : RESOLVE_REPLY_PLAN.leavesOpen}
                  </span>
                  <p className="whitespace-pre-wrap break-words text-2xs text-foreground">
                    {reply.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
