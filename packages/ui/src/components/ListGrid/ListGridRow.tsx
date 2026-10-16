import { useContext, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../../cn';
import { OptionalTooltip } from '../OptionalTooltip';
import { ROW_INTERACTIVE } from '../../rowInteractive';
import { SELECTED_ROW_CLASSES } from '../../selectedRow';
import { TEXT_ROLE } from '../../textRoles';
import { ListGridColumnsContext } from './ListGridColumnsContext';
import type { ListGridColumn } from './listGridTemplate';

export type ListGridRowProps = {
  readonly cells: ReadonlyArray<ReactNode>;
  readonly onSelect?: () => void;
  readonly isSelected?: boolean;
  readonly ariaLabel?: string;
  readonly tooltip?: ReactNode;
  readonly rowHeight?: 28 | 32;
  readonly isOption?: boolean;
  readonly isCursor?: boolean;
  readonly optionId?: string;
  readonly rowKey?: string;
  readonly onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
};

type ToneParams = {
  readonly column: ListGridColumn | undefined;
};

type CellParams = ToneParams & {
  readonly cell: ReactNode;
  readonly isFirst: boolean;
};

const toneClass = ({ column }: ToneParams) => {
  if (column?.tone !== undefined) {
    return TEXT_ROLE[column.tone];
  }
  if (column?.isTitle === true) {
    return TEXT_ROLE.label;
  }
  return TEXT_ROLE.secondary;
};

const cellClass = ({ column, cell, isFirst }: CellParams) =>
  cn(
    'min-w-0',
    typeof cell === 'string' || typeof cell === 'number' ? 'truncate' : 'flex items-center gap-2',
    isFirst ? 'col-start-2' : '',
    column?.align === 'end' ? 'justify-self-end justify-end text-right' : '',
    column?.isNumeric === true ? 'tabular-nums' : '',
    column?.isTitle === true ? 'text-row' : '',
    toneClass({ column }),
  );

const HEIGHT_CLASS = { 28: 'h-7', 32: 'h-8' } as const;

export const ListGridRow = ({
  cells,
  onSelect,
  isSelected = false,
  ariaLabel,
  tooltip,
  rowHeight = 32,
  isOption = false,
  isCursor = false,
  optionId,
  rowKey,
  onContextMenu,
  onKeyDown,
}: ListGridRowProps) => {
  const columns = useContext(ListGridColumnsContext);
  const body = cells.map((cell, index) => (
    <span
      key={columns[index]?.key ?? index}
      data-list-grid-cell={columns[index]?.key}
      className={cellClass({ column: columns[index], cell, isFirst: index === 0 })}
    >
      {cell}
    </span>
  ));
  const rowClass = cn(
    'col-span-full grid grid-cols-subgrid items-center rounded-md text-left',
    HEIGHT_CLASS[rowHeight],
  );
  const itemRole = isOption ? 'presentation' : undefined;
  if (onSelect === undefined) {
    return (
      <li role={itemRole} className="col-span-full grid grid-cols-subgrid">
        <div className={rowClass}>{body}</div>
      </li>
    );
  }
  return (
    <li role={itemRole} className="col-span-full grid grid-cols-subgrid">
      <OptionalTooltip content={tooltip}>
        <button
          type="button"
          id={optionId}
          role={isOption ? 'option' : undefined}
          tabIndex={isOption ? -1 : undefined}
          data-list-grid-row=""
          data-row-key={rowKey}
          data-selected={isSelected}
          data-cursor={isCursor ? true : undefined}
          aria-selected={isOption ? isSelected : undefined}
          aria-current={!isOption && isSelected ? 'true' : undefined}
          aria-label={ariaLabel}
          onClick={onSelect}
          onContextMenu={onContextMenu}
          onKeyDown={onKeyDown}
          className={cn(
            rowClass,
            ROW_INTERACTIVE,
            SELECTED_ROW_CLASSES,
            isCursor && !isSelected && 'bg-hover',
          )}
        >
          {body}
        </button>
      </OptionalTooltip>
    </li>
  );
};
