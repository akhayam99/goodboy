import { X } from 'lucide-react';
import { Chip, IconButton } from '@goodboy/ui';
import { AgentKindChip } from '../../../../../shared/components/AgentKindChip';
import type { AgentKind } from '../../../../session/agent-kind';
import { QuestionPager, type QuestionPagerModel } from './QuestionPager';

type Props = {
  readonly askerName: string | null;
  readonly askerKind: AgentKind | null;
  readonly isBlocking: boolean;
  readonly age: string;
  readonly pager: QuestionPagerModel | null;
  readonly onDismiss: (() => void) | null;
};

export const QuestionCardTop = ({
  askerName,
  askerKind,
  isBlocking,
  age,
  pager,
  onDismiss,
}: Props) => (
  <div className="flex min-h-6 min-w-0 items-center gap-2 text-label text-muted-foreground">
    <AgentKindChip kind={askerKind ?? 'generic'} />
    <span className="min-w-0 truncate">
      <span className="text-foreground">{askerName ?? 'An agent'}</span> asks
    </span>
    {isBlocking && <Chip tone="warning" label="Blocking" shape="badge" bordered={false} />}
    {age.length > 0 && <span className="shrink-0 text-faint-foreground">{age}</span>}
    <span className="flex-1" />
    {pager !== null && <QuestionPager pager={pager} />}
    {onDismiss !== null && (
      <IconButton
        icon={X}
        label="Dismiss question"
        variant="ghost"
        iconSize={14}
        onClick={onDismiss}
      />
    )}
  </div>
);
