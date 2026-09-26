import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import {
  AnchoredPopover,
  InlineConfirm,
  LISTBOX_SEARCH_THRESHOLD,
  ScrollFade,
  filterOptions,
  listboxOptionId,
  useDropdown,
  useListboxKeyboard,
} from '@goodboy/ui';
import type { Workflow, WorkflowId } from '@goodboy/types';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { ControlChip } from './ControlChip';
import { PresetPickerOption } from './PresetPickerOption';

type Props = {
  readonly presets: ReadonlyArray<Workflow>;
  readonly selectedId: WorkflowId | null;
  readonly disabled: boolean;
  readonly onSelect: (preset: Workflow) => void;
  readonly onDelete: (preset: Workflow) => Promise<void>;
};

export const PresetPicker = ({ presets, selectedId, disabled, onSelect, onDelete }: Props) => {
  const listId = useId();
  const dropdown = useDropdown({ disabled, align: 'end', width: 'w-96', expectedHeight: 320 });
  const { open, close, toggle } = dropdown;
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [confirmingId, setConfirmingId] = useState<WorkflowId | null>(null);
  const selected = presets.find((preset) => preset.id === selectedId) ?? null;
  const confirming = presets.find((preset) => preset.id === confirmingId) ?? null;
  const isSearchable = presets.length > LISTBOX_SEARCH_THRESHOLD;
  const entries = useMemo(
    () =>
      filterOptions({
        options: presets.map((preset) => ({ value: preset.id, label: preset.name })),
        query,
      }),
    [presets, query],
  );
  const shown = entries.flatMap(({ option, match }) => {
    const preset = presets.find((candidate) => candidate.id === option.value);
    return preset === undefined ? [] : [{ preset, match }];
  });

  const choose = (index: number) => {
    const entry = shown[index];
    if (entry === undefined) {
      return;
    }
    onSelect(entry.preset);
    close();
  };

  const keyboard = useListboxKeyboard({
    items: shown.map(({ preset }) => ({ label: preset.name, isDisabled: false })),
    isOpen: open,
    isTypeaheadEnabled: !isSearchable,
    onOpen: toggle,
    onClose: close,
    onCommit: choose,
    onTab: close,
  });
  const { activeIndex, setActiveIndex } = keyboard;

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const current = shown.findIndex(({ preset }) => preset.id === selectedId);
    setActiveIndex(current === -1 ? 0 : current);
    if (isSearchable) {
      searchRef.current?.focus();
      return;
    }
    listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Pick a preset"
      className="flex max-h-96 flex-col gap-1 p-1 motion-safe:animate-popover-in"
      trigger={
        <ControlChip
          label="Preset"
          value={selected?.name ?? 'Pick a preset'}
          isOpen={open}
          disabled={disabled}
          onToggle={() => {
            setConfirmingId(null);
            toggle();
          }}
        />
      }
    >
      {confirming !== null ? (
        <InlineConfirm
          role="danger"
          surface="plain"
          icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
          title={`Delete ${confirming.name}?`}
          description="Removes this preset from the workspace. Runs that used it keep their steps."
          confirmLabel="Delete preset"
          onConfirm={async () => {
            await onDelete(confirming);
            setConfirmingId(null);
          }}
          onCancel={() => setConfirmingId(null)}
        />
      ) : (
        <div className="flex min-h-0 flex-col" onKeyDown={keyboard.onKeyDown}>
          {isSearchable ? (
            <div className="flex h-9 shrink-0 items-center gap-2 px-2 text-muted-foreground">
              <Search size={ICON_SIZE.row} aria-hidden className="shrink-0" />
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                aria-label="Search presets"
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0 ? listboxOptionId({ id: listId, index: activeIndex }) : undefined
                }
                autoComplete="off"
                value={query}
                placeholder="Search presets"
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-faint-foreground"
              />
            </div>
          ) : null}
          <ScrollFade
            className="flex min-h-0 flex-1 flex-col"
            viewportClassName="h-auto min-h-0 flex-1"
            fadeFrom="floating"
            fadeSize={12}
          >
            <div
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Presets"
              tabIndex={-1}
              aria-activedescendant={
                !isSearchable && activeIndex >= 0
                  ? listboxOptionId({ id: listId, index: activeIndex })
                  : undefined
              }
              className="flex flex-col outline-none"
            >
              {shown.map(({ preset, match }, index) => (
                <PresetPickerOption
                  key={preset.id}
                  id={listboxOptionId({ id: listId, index })}
                  preset={preset}
                  match={match}
                  isActive={index === activeIndex}
                  isSelected={preset.id === selectedId}
                  onActivate={() => setActiveIndex(index)}
                  onSelect={() => choose(index)}
                  onDelete={() => setConfirmingId(preset.id)}
                />
              ))}
              {shown.length === 0 ? (
                <p className="px-2 py-1.5 text-label text-faint-foreground">
                  {`No preset matches "${query.trim()}"`}
                </p>
              ) : null}
            </div>
          </ScrollFade>
        </div>
      )}
    </AnchoredPopover>
  );
};
