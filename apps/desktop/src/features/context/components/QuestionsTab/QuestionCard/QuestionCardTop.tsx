import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../session/agent-kind';
import { QuestionBlockingMark } from './QuestionBlockingMark';
import { QuestionCardControls } from './QuestionCardControls';
import type { QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly isBlocking: boolean;
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardTop = ({
  askerName,
  askerKind,
  age,
  isBlocking,
  pager,
  onDismiss,
}: Props) => (
  <div className="flex min-h-6 min-w-0 items-center justify-between gap-2 text-meta text-muted-foreground">
    <span className="flex min-w-0 items-center gap-2">
      <AgentKindChip kind={askerKind ?? 'generic'} />
      <span className="min-w-0 truncate">
        <span className="text-foreground">{askerName ?? 'An agent'}</span> asks
      </span>
      {age.length > 0 ? <span className="shrink-0 text-faint-foreground">{age}</span> : null}
      {isBlocking ? <QuestionBlockingMark /> : null}
    </span>
    <QuestionCardControls pager={pager} onDismiss={onDismiss} />
  </div>
);
