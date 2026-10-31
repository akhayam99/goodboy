import { X } from 'lucide-react';
import { ICON_SIZE, IconButton } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../session/agent-kind';
import { QuestionBlockingMark } from './QuestionBlockingMark';
import { QuestionPager, type QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly isBlocking: boolean;
  readonly age: string;
  readonly pager: QuestionPagerModel | null;
  readonly isInAskerConversation: boolean;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardTop = ({
  askerName,
  askerKind,
  isBlocking,
  age,
  pager,
  isInAskerConversation,
  onDismiss,
}: Props) => {
  const hasAsker = !isInAskerConversation;
  if (!hasAsker && !isBlocking && pager === null && onDismiss === null) {
    return null;
  }
  return (
    <div className="flex min-h-6 min-w-0 items-center gap-2 text-meta text-muted-foreground">
      {hasAsker ? (
        <>
          <AgentKindChip kind={askerKind ?? 'generic'} />
          <span className="min-w-0 truncate">
            <span className="text-foreground">{askerName ?? 'An agent'}</span> asks
          </span>
        </>
      ) : null}
      {isBlocking ? <QuestionBlockingMark /> : null}
      {hasAsker && age.length > 0 ? (
        <span className="shrink-0 text-faint-foreground">{age}</span>
      ) : null}
      <span className="flex-1" />
      {pager !== null && <QuestionPager pager={pager} />}
      {onDismiss !== null && (
        <IconButton
          icon={X}
          label="Dismiss question"
          variant="ghost"
          iconSize={ICON_SIZE.control}
          onClick={onDismiss}
        />
      )}
    </div>
  );
};
