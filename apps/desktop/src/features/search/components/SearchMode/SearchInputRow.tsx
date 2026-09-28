import type { KeyboardEvent, RefObject } from 'react';
import { CHIP_KEY_LABEL, type SearchChip } from '../../searchChips';
import type { SearchScope } from '../../searchScope';
import { SearchChipPill } from './SearchChipPill';

type Props = {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly text: string;
  readonly scope: SearchScope;
  readonly chips: ReadonlyArray<SearchChip>;
  readonly listboxId: string;
  readonly activeOptionId: string | null;
  readonly onTextChange: (text: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readonly onWiden: () => void;
  readonly onRemoveChip: (index: number) => void;
};

const SCOPE_EYEBROW: Readonly<Record<SearchScope['kind'], string>> = {
  session: 'In session',
  workspace: 'In',
  all: 'Everywhere',
};

export const SearchInputRow = ({
  inputRef,
  text,
  scope,
  chips,
  listboxId,
  activeOptionId,
  onTextChange,
  onKeyDown,
  onWiden,
  onRemoveChip,
}: Props) => (
  <div className="flex min-h-12 flex-wrap items-center gap-2 px-4 py-2">
    {scope.kind === 'all' ? null : (
      <SearchChipPill
        eyebrow={SCOPE_EYEBROW[scope.kind]}
        label={scope.label}
        removeLabel="Search wider"
        onRemove={onWiden}
      />
    )}
    {chips.map((chip, index) => (
      <SearchChipPill
        key={`${chip.key}-${chip.label}`}
        eyebrow={CHIP_KEY_LABEL[chip.key]}
        label={chip.label}
        removeLabel={`Remove ${CHIP_KEY_LABEL[chip.key]} ${chip.label}`}
        onRemove={() => onRemoveChip(index)}
      />
    ))}
    <input
      ref={inputRef}
      type="text"
      value={text}
      placeholder={
        scope.kind === 'all' ? 'Search everything' : 'Search, or type type: in: from: is:'
      }
      onChange={(event) => onTextChange(event.target.value)}
      onKeyDown={onKeyDown}
      role="combobox"
      aria-expanded
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={activeOptionId ?? undefined}
      aria-label="Search"
      spellCheck={false}
      className="min-w-40 flex-1 bg-transparent text-body text-foreground placeholder:text-faint-foreground focus-visible:outline-none"
    />
  </div>
);
