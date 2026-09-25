import { MessageSquareReply, TextQuote, X } from 'lucide-react';
import { IconButton } from '@goodboy/ui';
import type { ReplyTarget } from './useReplyTarget';

type Props = {
  readonly target: ReplyTarget;
  readonly onClear: () => void;
};

const EXCERPT_LENGTH = 60;

const excerptOf = (body: string): string => {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH).trimEnd()}...` : flat;
};

export const ReplyBar = ({ target, onClear }: Props) => {
  const Icon = target.mode === 'quote' ? TextQuote : MessageSquareReply;
  const verb = target.mode === 'quote' ? 'Quoting' : 'Replying to';

  return (
    <div
      data-slot="reply-bar"
      className="flex min-w-0 items-center gap-1.5 rounded-t-lg bg-muted py-1 pl-2.5 pr-1 text-2xs text-muted-foreground"
    >
      <Icon size={12} aria-hidden className="shrink-0" />
      <span className="shrink-0">
        {verb} <span className="font-semibold text-foreground">{target.message.author.name}</span>
      </span>
      <span className="min-w-0 flex-1 truncate text-faint-foreground">
        {excerptOf(target.message.body)}
      </span>
      <IconButton icon={X} label="Cancel reply" variant="ghost" iconSize={12} onClick={onClear} />
    </div>
  );
};
