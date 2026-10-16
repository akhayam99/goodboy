import { ChevronDown } from 'lucide-react';
import { AnchoredPopover, PANE_RHYTHM, Tooltip, cn, useDropdown } from '@goodboy/ui';
import { ICON_SIZE } from '../../conceptIcons';
import { FactValue } from './FactValue';
import type { PropertyRowFacts } from './propertyGroupsOf';

type Props = {
  readonly row: PropertyRowFacts;
};

const LABEL = cn(PANE_RHYTHM.property.label, 'truncate text-ui text-muted-foreground');

export const PropertyRow = ({ row }: Props) => {
  const dropdown = useDropdown({ width: 'w-60', expectedHeight: 240, expectedWidth: 240 });
  const [first] = row.facts;
  const editor = row.facts.length === 1 ? first?.editor : undefined;
  if (first === undefined) {
    return null;
  }
  if (editor === undefined) {
    return (
      <>
        <dt data-fact-slot={first.slot} className={LABEL}>
          {row.label}
        </dt>
        <dd className={cn(PANE_RHYTHM.property.value, 'text-ui text-foreground')}>
          {row.facts.map((fact) => (
            <FactValue key={fact.key} fact={fact} />
          ))}
        </dd>
      </>
    );
  }
  const actionLabel = `Change ${row.label.toLowerCase()}`;
  return (
    <>
      <dt data-fact-slot={first.slot} className={LABEL}>
        {row.label}
      </dt>
      <dd className="flex min-h-7 min-w-0">
        <AnchoredPopover
          dropdown={dropdown}
          role="menu"
          ariaLabel={actionLabel}
          anchorClassName="min-w-0 flex-1"
          trigger={
            <Tooltip content={actionLabel}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={dropdown.open}
                aria-label={actionLabel}
                onClick={dropdown.toggle}
                className={cn(
                  'flex min-h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-ui text-foreground',
                  'hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
                  dropdown.open && 'bg-hover',
                )}
              >
                <FactValue fact={first} />
                <ChevronDown
                  size={ICON_SIZE.row}
                  aria-hidden
                  className="shrink-0 text-faint-foreground"
                />
              </button>
            </Tooltip>
          }
        >
          {editor({ close: dropdown.close })}
        </AnchoredPopover>
      </dd>
    </>
  );
};
