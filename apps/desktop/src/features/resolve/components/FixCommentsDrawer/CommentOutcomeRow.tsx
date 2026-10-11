import { inlineMarkdownText } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import type { AgentKindRouting } from '../../../session/agent-kind';
import type { CommentOutcome } from '../../commentOutcome';
import { OUTCOME_ACTION } from '../../commentOutcomeCopy';
import { RESOLVE_COMMENT_UNAVAILABLE } from '../../resolveQueueCopy';
import { firstSentence } from '../ReviewFlow/firstSentence';
import type { ReviewEntry } from '../ReviewFlow/useReviewEntries';
import { CommentOutcomeChip } from '../CommentOutcomeChip';
import { isNoteEntry } from './commentFilter';
import { OutcomeFailed } from './OutcomeFailed';
import { OutcomeFixed } from './OutcomeFixed';
import { OutcomeFixProposed } from './OutcomeFixProposed';
import { OutcomeQuestion } from './OutcomeQuestion';
import { OutcomeReply } from './OutcomeReply';

type Props = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
  readonly outcome: CommentOutcome;
  readonly routing: AgentKindRouting;
  readonly isHeaderShown: boolean;
  readonly onStarted: () => void;
};

type BodyProps = Omit<Props, 'isHeaderShown'>;

const bodyOf = ({ sessionId, entry, outcome, routing, onStarted }: BodyProps) => {
  const isNote = isNoteEntry({ entry });
  switch (outcome.kind) {
    case 'waiting':
      return null;
    case 'working':
      return <p className="text-meta text-muted-foreground">{OUTCOME_ACTION.working}</p>;
    case 'fix-proposed':
      return <OutcomeFixProposed sessionId={sessionId} entry={entry} />;
    case 'fixed':
      return <OutcomeFixed sessionId={sessionId} entry={entry} sha={outcome.sha} isNote={isNote} />;
    case 'question':
      return (
        <OutcomeQuestion sessionId={sessionId} entry={entry} text={outcome.text} isNote={isNote} />
      );
    case 'no-change':
      return (
        <OutcomeReply sessionId={sessionId} entry={entry} reply={outcome.reply} isNote={isNote} />
      );
    case 'failed':
      return (
        <OutcomeFailed
          sessionId={sessionId}
          entry={entry}
          sentence={outcome.sentence}
          routing={routing}
          onStarted={onStarted}
        />
      );
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
};

export const CommentOutcomeRow = ({
  sessionId,
  entry,
  outcome,
  routing,
  isHeaderShown,
  onStarted,
}: Props) => {
  const note = entry.row.reviewerNote;
  const body = note === null ? null : inlineMarkdownText({ text: note.body });
  const title = body === null ? RESOLVE_COMMENT_UNAVAILABLE : firstSentence({ text: body });
  return (
    <div
      role="group"
      aria-label={`${note?.author ?? 'Unknown'} comment outcome`}
      className="flex min-w-0 flex-col gap-2 rounded-md px-2 py-1"
    >
      {isHeaderShown && (
        <span className="flex min-w-0 items-center gap-2 text-meta">
          <CommentOutcomeChip outcome={outcome} />
          {note !== null && <span className="shrink-0 text-muted-foreground">{note.author}</span>}
          <span className="min-w-0 truncate text-body text-foreground">{title}</span>
        </span>
      )}
      {!isHeaderShown && <CommentOutcomeChip outcome={outcome} />}
      {bodyOf({ sessionId, entry, outcome, routing, onStarted })}
    </div>
  );
};
