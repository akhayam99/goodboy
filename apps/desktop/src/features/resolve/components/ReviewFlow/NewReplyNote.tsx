import { MessageSquare } from 'lucide-react';
import type { PrComment } from '@goodboy/types';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { newReplyLine } from '../../reviewFlowCopy';

type Props = {
  readonly replies: ReadonlyArray<PrComment>;
};

export const NewReplyNote = ({ replies }: Props) => {
  const authors = [...new Set(replies.map((reply) => reply.author))];
  return (
    <details className="group/reply-note min-w-0 rounded-lg bg-subtle px-4 py-2.5 text-secondary">
      <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring [&::-webkit-details-marker]:hidden">
        <MessageSquare size={ICON_SIZE.control} aria-hidden className="shrink-0" />
        <span className="min-w-0 truncate">{newReplyLine({ authors })}</span>
      </summary>
      <ul className="mt-2 flex min-w-0 flex-col gap-2">
        {replies.map((reply) => (
          <li key={reply.id} className="min-w-0 list-none text-foreground">
            <span className="text-muted-foreground">{reply.author}: </span>
            <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{reply.body}</span>
          </li>
        ))}
      </ul>
    </details>
  );
};
