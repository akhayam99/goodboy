import { ICON_SIZE, SelectableRow } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { openThreadsLineOf } from './openThreadsLineOf';

type Props = {
  readonly unresolved: number;
  readonly unreadCount: number;
  readonly needYou: number;
  readonly onOpen: () => void;
};

export const OpenThreadsLink = ({ unresolved, unreadCount, needYou, onOpen }: Props) => {
  const line = openThreadsLineOf({ unresolved, unreadCount, needYou });
  if (line === null) {
    return null;
  }
  return (
    <SelectableRow
      selected={false}
      ariaLabel="Open comments"
      testId="open-threads"
      className="min-w-0 items-center gap-2 rounded-lg bg-subtle px-3 py-2 text-meta"
      onClick={onOpen}
    >
      <CONCEPT_ICONS.comments
        size={ICON_SIZE.row}
        aria-hidden
        className={needYou > 0 ? 'text-warning' : 'text-faint-foreground'}
      />
      <span className={needYou > 0 ? 'text-foreground' : 'text-muted-foreground'}>{line}</span>
    </SelectableRow>
  );
};
