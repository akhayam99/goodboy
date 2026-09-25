import { ShortcutGroupSurface } from './ShortcutGroupSurface';
import { SHORTCUT_COLUMNS } from './shortcutRows';

export const ShortcutsSection = () => (
  <div id="keyboard-shortcuts-list" className="grid grid-cols-2 gap-4">
    {SHORTCUT_COLUMNS.map((column) => (
      <div
        key={column.join('-')}
        className="flex min-w-0 flex-col gap-4 [&>section:last-child]:flex-1"
      >
        {column.map((group) => (
          <ShortcutGroupSurface key={group} group={group} />
        ))}
      </div>
    ))}
  </div>
);
