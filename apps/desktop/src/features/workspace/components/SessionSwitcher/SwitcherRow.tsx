import { SelectableRow, StatusMark } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionRowTitle } from '../SessionRowTitle';
import { useSessionRowFacts } from '../../hooks/useSessionRowFacts';

type Props = {
  readonly session: Session;
  readonly isSelected: boolean;
  readonly onChoose: () => void;
};

export const SwitcherRow = ({ session, isSelected, onChoose }: Props) => {
  const { summary, mark, keys, title } = useSessionRowFacts({ session });
  return (
    <SelectableRow
      role="option"
      selected={isSelected}
      ariaSelected={isSelected}
      tabIndex={-1}
      onClick={onChoose}
      className="h-9 items-center gap-3 px-3 text-meta"
    >
      <StatusMark mark={mark} />
      <SessionRowTitle keys={keys} title={title} className="flex-1" titleClassName="truncate" />
      <span className="shrink-0 text-meta text-faint-foreground">{summary.age}</span>
    </SelectableRow>
  );
};
