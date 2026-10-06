import { SelectableRow } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionSummary } from '../../hooks/useSessionSummary';
import { sessionRowTitle } from '../../../session/sessionTitle';
import { SessionRowTitle } from '../SessionRowTitle';
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
  const { keys, title } = sessionRowTitle({ session, tasks: summary.tasks });
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
      <SessionRowTitle keys={keys} title={title} className="flex-1" titleClassName="truncate" />
      <span className="shrink-0 text-meta text-faint-foreground">{summary.age}</span>
    </SelectableRow>
  );
};
