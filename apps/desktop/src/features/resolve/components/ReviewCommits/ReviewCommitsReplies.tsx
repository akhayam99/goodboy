import { Eyebrow, Switch } from '@goodboy/ui';
import { replyUpdateLine } from '../../replyUpdateLine';
import { REVIEW_COMMITS_LABEL, commitForLine, unpostedReplyLine } from '../../reviewCommitsCopy';
import type { ReviewCommitsModel } from './useReviewCommits';

type Props = {
  readonly model: ReviewCommitsModel;
};

type Reply = ReviewCommitsModel['replies'][number];

const lineOf = ({ reply, isEditing }: { readonly reply: Reply; readonly isEditing: boolean }) => {
  if (reply.to === null) {
    return REVIEW_COMMITS_LABEL.waitingForCheck;
  }
  if (!reply.isPosted) {
    return unpostedReplyLine({ from: reply.from, to: reply.to, isFolded: reply.isFolded });
  }
  return isEditing
    ? replyUpdateLine({ from: reply.from, to: reply.to, isFolded: reply.isFolded })
    : REVIEW_COMMITS_LABEL.postedLeft;
};

export const ReviewCommitsReplies = ({ model }: Props) => {
  if (!model.hasChange || model.replies.length === 0) {
    return null;
  }
  const hasPosted = model.replies.some((reply) => reply.isPosted);
  return (
    <section aria-label={REVIEW_COMMITS_LABEL.replies} className="flex flex-col gap-2">
      <div className="flex h-6 items-center gap-2">
        <Eyebrow label={REVIEW_COMMITS_LABEL.replies} muted />
        {hasPosted && (
          <span className="ml-auto flex items-center gap-2 text-label text-muted-foreground">
            {REVIEW_COMMITS_LABEL.editPosted}
            <Switch
              label={model.isEditingPosted ? 'On' : 'Off'}
              checked={model.isEditingPosted}
              onChange={model.setEditingPosted}
            />
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {model.replies.map((reply) => (
          <li
            key={reply.threadId}
            className="flex min-w-0 list-none flex-col gap-1 rounded-lg bg-subtle px-3 py-2 text-secondary"
          >
            <span className="flex min-w-0 items-baseline gap-2 text-label text-muted-foreground">
              <span className="min-w-0 truncate">
                {commitForLine({ author: reply.author, location: reply.location })}
              </span>
              <span className="ml-auto shrink-0 text-faint-foreground">
                {reply.isPosted ? REVIEW_COMMITS_LABEL.posted : REVIEW_COMMITS_LABEL.goesOut}
              </span>
            </span>
            {reply.text !== '' && !reply.isPosted && (
              <span className="min-w-0 text-foreground">{reply.text}</span>
            )}
            <span className="min-w-0 text-secondary text-foreground">
              {lineOf({ reply, isEditing: model.isEditingPosted })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
