import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { CountToggle } from '@goodboy/ui';
import type { ResolvePublicationPreview } from '@goodboy/types';
import { excludedLine, heldBackNote, publicationCountsLine } from '../../resolvePublishCopy';
import { RESOLVE_DELIVERY_SUPPORT, RESOLVE_PUBLISH_REPLIES_LABEL } from '../../resolveQueueCopy';

type Props = {
  readonly preview: ResolvePublicationPreview;
};

export const PublishLines = ({ preview }: Props) => {
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
                    {reply.closes
                      ? RESOLVE_DELIVERY_SUPPORT.threadResolved
                      : RESOLVE_DELIVERY_SUPPORT.threadLeftOpen}
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
