import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../session/agent-kind';
import { QuestionCardControls } from './QuestionCardControls';
import type { QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly age: string;
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardTop = ({ askerName, askerKind, age, pager, onDismiss }: Props) => (
  <div className="flex min-h-6 min-w-0 items-center gap-2 text-meta text-muted-foreground">
    <AgentKindChip kind={askerKind ?? 'generic'} />
    <span className="min-w-0 truncate">
      <span className="text-foreground">{askerName ?? 'An agent'}</span> asks
    </span>
    {age.length > 0 ? <span className="shrink-0 text-faint-foreground">{age}</span> : null}
    <span className="flex-1" />
    <QuestionCardControls pager={pager} onDismiss={onDismiss} />
  </div>
);
