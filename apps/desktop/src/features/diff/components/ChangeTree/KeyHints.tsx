import { AnchoredPopover, useDropdown } from '@goodboy/ui';
import { KEY_HELP, KEY_HELP_ROWS } from './keyHelp';

export const KeyHints = () => {
  const dropdown = useDropdown({ align: 'start', width: 'min-w-[200px]', expectedHeight: 260 });
  return (
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap px-3 py-2 text-meta text-faint-foreground">
      <span className="min-w-0 truncate">{KEY_HELP}</span>
      <span aria-hidden>·</span>
      <AnchoredPopover
        dropdown={dropdown}
        role="dialog"
        ariaLabel="Keyboard shortcuts"
        className="py-2"
        trigger={
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={dropdown.open}
            onClick={dropdown.toggle}
            className="rounded-sm text-faint-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            ? all keys
          </button>
        }
      >
        <dl className="flex flex-col gap-1 px-3 text-meta">
          {KEY_HELP_ROWS.map(([keys, label]) => (
            <div key={label} className="flex items-baseline justify-between gap-6">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums text-foreground">{keys}</dd>
            </div>
          ))}
        </dl>
      </AnchoredPopover>
    </div>
  );
};
