import { Search, X } from 'lucide-react';
import { Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export const ManifestSearchInput = ({ value, onChange }: Props) => (
  <div className="flex items-center gap-2 rounded-md border border-border-soft bg-muted/30 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-[var(--color-focus-ring)]">
    <Search size={ICON_SIZE.control} className="shrink-0 text-muted-foreground" aria-hidden />
    <input
      type="search"
      aria-label="Search scripts"
      placeholder="Search scripts"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return;
        }
        event.preventDefault();
        onChange('');
      }}
      className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
    />
    {value !== '' ? (
      <Tooltip content="Clear search">
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        >
          <X size={ICON_SIZE.control} aria-hidden />
        </button>
      </Tooltip>
    ) : null}
  </div>
);
