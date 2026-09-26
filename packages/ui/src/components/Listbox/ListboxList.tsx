import { Fragment } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '../../cn';
import { Eyebrow } from '../Eyebrow';
import type { FilteredOption } from './filterOptions';
import { ListboxOptionRow } from './ListboxOptionRow';
import type { ListboxValue } from './listboxTypes';

export type ListboxListProps<T extends ListboxValue> = {
  readonly id: string;
  readonly ariaLabel?: string;
  readonly entries: ReadonlyArray<FilteredOption<T>>;
  readonly activeIndex: number;
  readonly selectedValues: ReadonlyArray<T>;
  readonly isMultiple?: boolean;
  readonly createLabel?: string;
  readonly className?: string;
  readonly onSelect: (index: number) => void;
  readonly onActivate: (index: number) => void;
};

export const listboxOptionId = ({ id, index }: { id: string; index: number }): string =>
  `${id}-option-${index}`;

export const ListboxList = <T extends ListboxValue>({
  id,
  ariaLabel,
  entries,
  activeIndex,
  selectedValues,
  isMultiple = false,
  createLabel,
  className,
  onSelect,
  onActivate,
}: ListboxListProps<T>) => {
  const hasLeadingSlot = entries.some(({ option }) => option.leading !== undefined);
  const createIndex = entries.length;

  return (
    <div
      id={id}
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={isMultiple || undefined}
      className={cn('flex min-w-0 flex-col', className)}
    >
      {entries.map(({ option, match }, index) => {
        const previousGroup = entries[index - 1]?.option.group;
        const isGroupStart = option.group !== undefined && option.group !== previousGroup;
        return (
          <Fragment key={String(option.value)}>
            {isGroupStart ? (
              <div
                role="presentation"
                className={cn('flex px-2 pb-1', index === 0 ? 'pt-1' : 'pt-2')}
              >
                <Eyebrow label={option.group} muted />
              </div>
            ) : null}
            <ListboxOptionRow
              id={listboxOptionId({ id, index })}
              label={option.label}
              description={option.description}
              leading={option.leading}
              meta={option.meta}
              match={match}
              isCode={option.isCode}
              isActive={index === activeIndex}
              isSelected={selectedValues.includes(option.value)}
              disabledReason={option.disabledReason}
              isMultiple={isMultiple}
              hasLeadingSlot={hasLeadingSlot}
              onSelect={() => onSelect(index)}
              onActivate={() => onActivate(index)}
            />
          </Fragment>
        );
      })}
      {createLabel !== undefined ? (
        <ListboxOptionRow
          id={listboxOptionId({ id, index: createIndex })}
          label={createLabel}
          leading={<Plus size={14} />}
          isActive={createIndex === activeIndex}
          isSelected={false}
          hasLeadingSlot
          onSelect={() => onSelect(createIndex)}
          onActivate={() => onActivate(createIndex)}
        />
      ) : null}
    </div>
  );
};
