import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { Search } from 'lucide-react';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly value: string;
  readonly placeholder: string;
  readonly ariaLabel: string;
  readonly listboxId: string;
  readonly activeDescendant: string | undefined;
  readonly chip: ReactNode;
  readonly modeSwitch: ReactNode;
  readonly onChange: (value: string) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export const PaletteInputRow = ({
  inputRef,
  value,
  placeholder,
  ariaLabel,
  listboxId,
  activeDescendant,
  chip,
  modeSwitch,
  onChange,
  onKeyDown,
}: Props) => (
  <div className="flex h-14 shrink-0 items-center gap-3 px-4">
    <Search size={ICON_SIZE.control} aria-hidden className="shrink-0 text-muted-foreground" />
    {chip}
    <input
      ref={inputRef}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
      role="combobox"
      aria-expanded
      aria-controls={listboxId}
      aria-autocomplete="list"
      aria-activedescendant={activeDescendant}
      aria-label={ariaLabel}
      spellCheck={false}
      autoComplete="off"
      className="h-full min-w-0 flex-1 bg-transparent text-body text-foreground placeholder:text-faint-foreground focus-visible:outline-none"
    />
    {modeSwitch}
  </div>
);
