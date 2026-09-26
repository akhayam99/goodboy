import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../cn';
import { useDropdown } from '../../useDropdown';
import { AnchoredPopover } from '../AnchoredPopover';
import { Button } from '../Button';
import { ScrollFade } from '../ScrollFade';
import { Tooltip } from '../Tooltip';
import { filterOptions } from './filterOptions';
import { ListboxList, listboxOptionId } from './ListboxList';
import { ListboxTrigger } from './ListboxTrigger';
import type {
  ListboxCreate,
  ListboxOption,
  ListboxSize,
  ListboxTriggerVariant,
  ListboxValue,
} from './listboxTypes';
import { edgeIndex, useListboxKeyboard } from './useListboxKeyboard';

export type { ListboxCreate, ListboxOption, ListboxSize, ListboxTriggerVariant, ListboxValue };

type CommonProps<T extends ListboxValue> = {
  readonly options: ReadonlyArray<ListboxOption<T>>;
  readonly trigger?: ListboxTriggerVariant;
  readonly size?: ListboxSize;
  readonly placeholder?: string;
  readonly searchable?: boolean;
  readonly searchLabel?: string;
  readonly searchPlaceholder?: string;
  readonly noun?: string;
  readonly ariaLabel?: string;
  readonly id?: string;
  readonly testId?: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
  readonly valueLabel?: ReactNode;
  readonly create?: ListboxCreate;
  readonly status?: ReactNode;
  readonly footer?: (params: { readonly close: () => void }) => ReactNode;
  readonly align?: 'start' | 'end';
  readonly openEvent?: string;
  readonly isBlock?: boolean;
  readonly className?: string;
  readonly anchorClassName?: string;
  readonly onOpenChange?: (isOpen: boolean) => void;
};

type SingleProps<T extends ListboxValue> = CommonProps<T> & {
  readonly multiple?: false;
  readonly value: T | null;
  readonly onChange: (value: T) => void;
};

type MultipleProps<T extends ListboxValue> = CommonProps<T> & {
  readonly multiple: true;
  readonly value: ReadonlyArray<T>;
  readonly onChange: (values: ReadonlyArray<T>) => void;
};

export type ListboxProps<T extends ListboxValue> = SingleProps<T> | MultipleProps<T>;

export const LISTBOX_SEARCH_THRESHOLD = 8;

const NO_VALUES: ReadonlyArray<never> = [];

const selectedValuesOf = <T extends ListboxValue>(props: ListboxProps<T>): ReadonlyArray<T> => {
  if (props.multiple === true) {
    return props.value;
  }
  return props.value === null ? NO_VALUES : [props.value];
};

export const Listbox = <T extends ListboxValue>(props: ListboxProps<T>) => {
  const {
    options,
    trigger = 'field',
    size = 'md',
    placeholder = 'Choose',
    searchable,
    searchLabel = 'Search',
    searchPlaceholder = 'Search',
    noun = 'option',
    ariaLabel,
    id,
    testId,
    disabled = false,
    disabledReason,
    valueLabel,
    create,
    status,
    footer,
    align = 'start',
    openEvent,
    isBlock = false,
    className,
    anchorClassName,
    onOpenChange,
  } = props;
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const dropdown = useDropdown({
    disabled,
    align,
    width: 'w-max max-w-90',
    expectedHeight: 320,
    expectedWidth: 240,
    openEvent,
    isAtLeastTriggerWidth: true,
  });
  const isOpen = dropdown.open;
  const isMultiple = props.multiple === true;
  const isSearchable = searchable ?? options.length > LISTBOX_SEARCH_THRESHOLD;
  const selectedValues = selectedValuesOf(props);
  const trimmedQuery = query.trim();
  const entries = useMemo(() => filterOptions({ options, query }), [options, query]);
  const hasExactMatch = options.some(
    (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const createLabel =
    create !== undefined && trimmedQuery !== '' && !hasExactMatch
      ? create.label(trimmedQuery)
      : undefined;
  const keyItems = useMemo(
    () => [
      ...entries.map(({ option }) => ({
        label: option.label,
        isDisabled: option.disabledReason !== undefined,
      })),
      ...(createLabel === undefined ? [] : [{ label: createLabel, isDisabled: false }]),
    ],
    [createLabel, entries],
  );

  const closeToTrigger = useCallback(() => {
    dropdown.close();
    triggerRef.current?.focus();
  }, [dropdown]);

  const commit = (index: number) => {
    if (index === entries.length && createLabel !== undefined && create !== undefined) {
      create.onCreate(trimmedQuery);
      closeToTrigger();
      return;
    }
    const option = entries[index]?.option;
    if (option === undefined || option.disabledReason !== undefined) {
      return;
    }
    if (props.multiple === true) {
      const next = props.value.includes(option.value)
        ? props.value.filter((value) => value !== option.value)
        : [...props.value, option.value];
      props.onChange(next);
      return;
    }
    props.onChange(option.value);
    closeToTrigger();
  };

  const keyboard = useListboxKeyboard({
    items: keyItems,
    isOpen,
    isTypeaheadEnabled: !isSearchable,
    onOpen: dropdown.toggle,
    onClose: closeToTrigger,
    onCommit: commit,
    onTab: () => {
      dropdown.close();
      if (document.activeElement === searchRef.current) {
        triggerRef.current?.focus();
      }
    },
  });
  const { activeIndex, setActiveIndex } = keyboard;

  useEffect(() => {
    onOpenChange?.(isOpen);
    if (!isOpen) {
      setQuery('');
      return;
    }
    const firstSelected = selectedValues[0];
    const current =
      firstSelected === undefined
        ? -1
        : options.findIndex((option) => option.value === firstSelected);
    setActiveIndex(current === -1 ? edgeIndex({ items: keyItems, isLast: false }) : current);
    if (isSearchable) {
      searchRef.current?.focus();
      return;
    }
    triggerRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setActiveIndex(edgeIndex({ items: keyItems, isLast: false }));
  }, [query]);

  const activeId =
    isOpen && activeIndex >= 0 ? listboxOptionId({ id: listboxId, index: activeIndex }) : undefined;

  useEffect(() => {
    if (activeId === undefined) {
      return;
    }
    const element = document.getElementById(activeId);
    if (element !== null && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }, [activeId]);

  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const firstSelectedOption = selectedOptions[0];
  const triggerContent =
    valueLabel ??
    (firstSelectedOption === undefined ? (
      <span className="truncate text-faint-foreground">{placeholder}</span>
    ) : (
      <>
        {!isMultiple && firstSelectedOption.leading !== undefined ? (
          <span aria-hidden className="flex size-4 shrink-0 items-center justify-center">
            {firstSelectedOption.leading}
          </span>
        ) : null}
        <span className={cn('truncate', firstSelectedOption.isCode === true && 'text-code')}>
          {selectedOptions.length > 1
            ? `${selectedOptions.length} selected`
            : firstSelectedOption.label}
        </span>
      </>
    ));

  const triggerButton = (
    <ListboxTrigger
      variant={trigger}
      size={size}
      isOpen={isOpen}
      disabled={disabled}
      isBlock={isBlock}
      id={id}
      testId={testId}
      value={selectedValues.join(',')}
      ariaLabel={ariaLabel}
      listboxId={listboxId}
      activeDescendant={isSearchable ? undefined : activeId}
      buttonRef={triggerRef}
      className={className}
      onClick={dropdown.toggle}
      onKeyDown={keyboard.onKeyDown}
    >
      {triggerContent}
    </ListboxTrigger>
  );

  const hasQuery = trimmedQuery !== '';
  const isEmpty = entries.length === 0;
  const hasList = !isEmpty || createLabel !== undefined;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      anchorClassName={cn(isBlock ? 'flex w-full' : 'inline-flex max-w-full', anchorClassName)}
      className="origin-top motion-safe:animate-popover-in"
      trigger={
        disabled && disabledReason !== undefined ? (
          <Tooltip content={disabledReason}>{triggerButton}</Tooltip>
        ) : (
          triggerButton
        )
      }
    >
      <div className="flex max-h-80 min-h-0 min-w-0 flex-col">
        {isSearchable ? (
          <div className="flex h-9 shrink-0 items-center gap-2 px-3 text-muted-foreground">
            <Search size={14} aria-hidden className="shrink-0" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label={searchLabel}
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              autoComplete="off"
              spellCheck={false}
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={keyboard.onKeyDown}
              className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-faint-foreground"
            />
            {hasQuery ? (
              <span className="shrink-0 text-meta text-faint-foreground">
                {entries.length} of {options.length}
              </span>
            ) : null}
          </div>
        ) : null}
        {status !== undefined ? (
          <div className="px-3 py-2 text-label text-muted-foreground">{status}</div>
        ) : null}
        {status === undefined && isEmpty ? (
          <div className="px-3 py-2 text-label text-faint-foreground">
            {hasQuery ? `No ${noun} matches "${trimmedQuery}"` : `No ${noun}s yet`}
          </div>
        ) : null}
        {hasList ? (
          <ScrollFade
            className="flex min-h-0 flex-1 flex-col"
            viewportClassName="h-auto min-h-0 flex-1 p-1"
            fadeFrom="floating"
            fadeSize={12}
          >
            <ListboxList
              id={listboxId}
              ariaLabel={ariaLabel}
              entries={entries}
              activeIndex={activeIndex}
              selectedValues={selectedValues}
              isMultiple={isMultiple}
              createLabel={createLabel}
              onSelect={commit}
              onActivate={setActiveIndex}
            />
          </ScrollFade>
        ) : null}
        {isMultiple ? (
          <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-1">
            <span className="text-meta text-faint-foreground">
              {selectedValues.length} of {options.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={selectedValues.length === 0}
              onClick={() => {
                if (props.multiple === true) {
                  props.onChange([]);
                }
              }}
            >
              Clear
            </Button>
          </div>
        ) : null}
        {footer === undefined ? null : (
          <div className="flex shrink-0 flex-col p-1">{footer({ close: closeToTrigger })}</div>
        )}
      </div>
    </AnchoredPopover>
  );
};
