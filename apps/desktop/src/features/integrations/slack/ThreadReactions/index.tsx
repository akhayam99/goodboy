import { Tooltip } from '@goodboy/ui';
import type { SlackReaction } from '../client';
import type { SlackReactionPick } from '../useSlackThreadActions';
import { QUICK_REACTIONS, reactionEmoji } from './quickReactions';

type Props = {
  readonly messageTs: string;
  readonly reactions: ReadonlyArray<SlackReaction>;
  readonly isWriting: boolean;
  readonly onReact: ((pick: SlackReactionPick) => void) | null;
};

type ReasonParams = {
  readonly canReact: boolean;
  readonly isWriting: boolean;
};

const blockReason = ({ canReact, isWriting }: ReasonParams): string | null => {
  if (!canReact) {
    return 'Reactions are off for this thread';
  }
  if (isWriting) {
    return 'Waiting for the current Slack write';
  }
  return null;
};

const PILL =
  'inline-flex items-center gap-1 rounded-full border border-border-soft px-2 py-0.5 text-chip text-muted-foreground motion-safe:transition-colors hover:border-border hover:bg-hover hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const QUICK_ROW = 'flex items-center gap-1';

export const ThreadReactions = ({ messageTs, reactions, isWriting, onReact }: Props) => {
  const reason = blockReason({ canReact: onReact != null, isWriting });
  const isBlocked = reason != null;
  const existing = new Set(reactions.map((reaction) => reaction.name));
  const quick = QUICK_REACTIONS.filter((reaction) => !existing.has(reaction.name));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {reactions.map((reaction) => (
        <Tooltip key={reaction.name} content={reason ?? `React with :${reaction.name}:`}>
          <button
            type="button"
            disabled={isBlocked}
            aria-label={`React with :${reaction.name}:`}
            onClick={() => onReact?.({ messageTs, name: reaction.name })}
            className={PILL}
          >
            <span aria-hidden>{reactionEmoji({ name: reaction.name })}</span>
            <span className="tabular-nums">{reaction.count}</span>
          </button>
        </Tooltip>
      ))}
      <div className={QUICK_ROW}>
        {quick.map((reaction) => (
          <Tooltip key={reaction.name} content={reason ?? `React with :${reaction.name}:`}>
            <button
              type="button"
              disabled={isBlocked}
              aria-label={`React with :${reaction.name}:`}
              onClick={() => onReact?.({ messageTs, name: reaction.name })}
              className={PILL}
            >
              <span aria-hidden>{reaction.emoji}</span>
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};
