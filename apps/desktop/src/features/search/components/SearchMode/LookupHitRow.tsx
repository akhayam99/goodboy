import { cn, tintClasses } from '@goodboy/ui';
import type { InboxRecord } from '../../../inbox/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly record: InboxRecord;
  readonly optionId: string;
  readonly isSelected: boolean;
  readonly onHover: () => void;
  readonly onOpen: () => void;
};

export const LookupHitRow = ({ record, optionId, isSelected, onHover, onOpen }: Props) => (
  <li
    id={optionId}
    role="option"
    aria-selected={isSelected}
    data-selected={isSelected ? 'true' : undefined}
    className={cn(
      'flex cursor-pointer items-start gap-3 rounded-sm px-3 py-2',
      isSelected ? 'bg-selected' : 'hover:bg-hover',
    )}
    onMouseEnter={onHover}
    onMouseDown={(event) => {
      event.preventDefault();
      onOpen();
    }}
  >
    <CONCEPT_ICONS.issues
      size={14}
      aria-hidden
      className={cn('mt-0.5 shrink-0', tintClasses(CONCEPT_TONE.issues).text)}
    />
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="truncate text-row text-foreground">
        <span className="text-code">{record.identifier}</span> {record.title}
      </span>
      <span className="truncate text-secondary text-faint-foreground">
        {record.stateLabel} · not in your index, opens in {record.provider}
      </span>
    </div>
    <span className="shrink-0 text-secondary text-faint-foreground">Look up</span>
  </li>
);
