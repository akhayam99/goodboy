import { InlineMarkdown, SelectableRow } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { sessionDisplayTitle } from '../../../session/sessionTitle';
import { sessionNodeOf } from '../SessionActivityBar/sessionNode';
import { SessionStateNode } from '../SessionActivityBar/SessionStateNode';

type Props = {
  readonly session: Session;
  readonly isSelected: boolean;
  readonly onChoose: () => void;
};

export const SwitcherRow = ({ session, isSelected, onChoose }: Props) => {
  const summary = useSessionSummary({ session });
  const node = sessionNodeOf({
    stage: summary.stage,
    attention: summary.attention,
    isArchived: false,
  });
  const title = sessionDisplayTitle({ session, tasks: summary.tasks });
  return (
    <SelectableRow
      role="option"
      selected={isSelected}
      ariaSelected={isSelected}
      tabIndex={-1}
      onClick={onChoose}
      className="h-9 items-center gap-3 px-3 text-label"
    >
      <SessionStateNode node={node} />
      <InlineMarkdown text={title} className="min-w-0 flex-1 truncate" />
      <span className="shrink-0 text-meta text-faint-foreground">{summary.age}</span>
    </SelectableRow>
  );
};
