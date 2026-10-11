import { AnchoredPopover, Button, Kbd, useDropdown } from '@goodboy/ui';
import { HISTORY_KEYS } from './useHistoryKeys/historyKeys';

export const HistoryKeysHint = () => {
  const dropdown = useDropdown({ align: 'end', expectedWidth: 260, expectedHeight: 180 });
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center">
      <span aria-hidden />
      <div className="flex min-w-0 items-center gap-2 px-3 text-label text-muted-foreground">
        <p className="min-w-0 truncate">
          Drag a commit to move it, drop it on another to fold it in.
        </p>
        <AnchoredPopover
          dropdown={dropdown}
          role="dialog"
          ariaLabel="Keyboard keys"
          className="p-3"
          trigger={
            <Button
              size="xs"
              variant="ghost"
              aria-haspopup="dialog"
              aria-expanded={dropdown.open}
              onClick={dropdown.toggle}
            >
              Keys
            </Button>
          }
        >
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
      </div>
    </div>
  );
};
