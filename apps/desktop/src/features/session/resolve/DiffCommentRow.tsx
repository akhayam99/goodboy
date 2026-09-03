import type { DiffComment } from '@goodboy/types';
import { markdownPreview } from '../../../shared/utils/markdownPreview';
import { diffCommentLocation } from '../diff-comment-location';

type Props = {
  readonly comment: DiffComment;
  readonly onOpen: () => void;
};

export const DiffCommentRow = ({ comment, onOpen }: Props) => {
  const location = diffCommentLocation({ comment });
  const preview = markdownPreview({ text: comment.body });
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full min-w-0 flex-col gap-0.5 rounded-lg border border-transparent bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
      >
        <div className="flex min-w-0 items-center gap-1.5 text-2xs text-muted-foreground/70">
          <span className="truncate font-mono tabular-nums text-muted-foreground/70">
            {location}
          </span>
        </div>
        {preview.length > 0 && (
          <p className="line-clamp-2 text-2xs leading-snug text-muted-foreground/90">{preview}</p>
        )}
      </button>
    </li>
  );
};
