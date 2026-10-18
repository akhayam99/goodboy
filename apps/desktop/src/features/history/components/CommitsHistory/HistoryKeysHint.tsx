import { Ellipsis } from 'lucide-react';
import { AnchoredPopover, IconButton, Kbd, ROW_INTERACTIVE, cn, useDropdown } from '@goodboy/ui';
import { openGuideChapter } from '../../../settings/openGuideChapter';
import { HISTORY_KEYS } from './useHistoryKeys/historyKeys';

export const HistoryKeysHint = () => {
  const dropdown = useDropdown({ align: 'end', expectedWidth: 280, expectedHeight: 240 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Help for this page"
      className="flex flex-col gap-3 p-3"
      trigger={
        <IconButton
          icon={Ellipsis}
          label="Commits help"
          tooltip="How to edit commits"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
        />
      }
    >
      <button
        type="button"
        onClick={() => {
          dropdown.close();
          openGuideChapter({ id: 'commits' });
        }}
        className={cn(ROW_INTERACTIVE, 'rounded-sm px-1 py-1 text-left text-label text-foreground')}
      >
        How to edit commits
      </button>
      <p className="px-1 text-eyebrow text-faint-foreground">Keys for this page</p>
      <ul className="flex flex-col gap-2">
        {HISTORY_KEYS.map((hint) => (
          <li key={hint.label} className="flex items-center gap-3 text-label">
            <span className="flex w-20 shrink-0 items-center gap-1">
              {hint.keys.map((key) => (
                <Kbd key={key} look="cap">
                  {key}
                </Kbd>
              ))}
            </span>
            <span className="text-muted-foreground">{hint.label}</span>
          </li>
        ))}
      </ul>
    </AnchoredPopover>
  );
};
