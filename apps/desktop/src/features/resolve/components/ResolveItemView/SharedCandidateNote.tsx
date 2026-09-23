import { Chip, inlineMarkdownText } from '@goodboy/ui';
import {
  PARTIAL_ACCEPTANCE,
  PARTIAL_REFUSAL,
} from '../../../../store/slices/resolve/acceptResolveQueueItem';
import { sharedCandidateBlocker, type SharedCandidateMember } from '../../sharedCandidateThreadIds';

type Props = {
  readonly members: ReadonlyArray<SharedCandidateMember>;
  readonly onSelectMember: (threadId: string) => void;
};

type SentenceParams = {
  readonly count: number;
};

const sharedCandidateSentence = ({ count }: SentenceParams): string =>
  count === 1
    ? 'Resolving this also resolves 1 other comment'
    : `Resolving this also resolves ${count} other comments`;

export const SharedCandidateNote = ({ members, onSelectMember }: Props) => {
  if (members.length === 0) {
    return null;
  }
  const blocker = sharedCandidateBlocker({ members });
  const warning =
    blocker === 'deferred' ? PARTIAL_ACCEPTANCE : blocker === 'wont_fix' ? PARTIAL_REFUSAL : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-l-2 border-border-soft py-0.5 pl-3">
      <p className="text-2xs font-medium text-foreground">
        {sharedCandidateSentence({ count: members.length })}
      </p>
      <ul className="flex min-w-0 flex-col gap-1">
        {members.map((member) => (
          <li key={member.queueItemId} className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectMember(member.threadId)}
              className="min-w-0 flex-1 truncate rounded-sm text-left text-2xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {member.title === null ? member.threadId : inlineMarkdownText({ text: member.title })}
            </button>
            {member.approvalState === 'deferred' && (
              <Chip size="3xs" tone="warning" bordered={false} label="Later" />
            )}
            {member.approvalState === 'wont_fix' && (
              <Chip size="3xs" tone="warning" bordered={false} label="Will not fix" />
            )}
          </li>
        ))}
      </ul>
      {warning !== null && <p className="text-2xs text-warning">{warning}</p>}
    </div>
  );
};
