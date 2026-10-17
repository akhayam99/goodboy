import { Keyboard } from 'lucide-react';
import { AnchoredPopover, IconButton, useDropdown } from '@goodboy/ui';
import { KEY_HELP, KEY_HELP_ROWS } from './keyHelp';

export const KeyHints = () => {
  const dropdown = useDropdown({ align: 'end', width: 'min-w-[200px]', expectedHeight: 260 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Keyboard shortcuts"
      className="py-2"
      trigger={
        <IconButton
          icon={Keyboard}
          size="xs"
          label="Keyboard shortcuts"
          tooltip={KEY_HELP}
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        />
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
  );
};
