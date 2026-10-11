import { useState } from 'react';
import { Button, ConfirmPopover, Eyebrow } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

export const RestoreBackupScene = () => {
  const [isRestored, setIsRestored] = useState(false);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 bg-background p-6"
    >
      <Eyebrow label="Backups · 2" muted />
      <ul className="flex flex-col">
        <li data-slot="backup-row" className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2">
          <span className="shrink-0 font-mono text-meta tabular-nums text-muted-foreground">
            a1f3c20
          </span>
          <span className="min-w-0 flex-1 truncate text-row text-foreground">
            Add ledger export endpoint
          </span>
          <span className="shrink-0 text-meta text-faint-foreground">3 Oct</span>
          {isRestored ? (
            <span role="status" className="shrink-0 text-meta text-muted-foreground">
              Restored
            </span>
          ) : (
            <ConfirmPopover
              role="danger"
              icon={<CONCEPT_ICONS.backup size={ICON_SIZE.row} aria-hidden />}
              title="Restore the backup from 3 Oct?"
              description="Your branch goes back to that state. The current one is kept as a backup."
              confirmLabel="Restore backup"
              onConfirm={async () => {
                await Promise.resolve();
                setIsRestored(true);
              }}
              trigger={({ isArmed, arm }) => (
                <Button size="sm" variant="ghost" aria-expanded={isArmed} onClick={arm}>
                  Restore previous history
                </Button>
              )}
            />
          )}
        </li>
        <li data-slot="backup-row" className="flex min-w-0 items-center gap-2 rounded-md px-2 py-2">
          <span className="shrink-0 font-mono text-meta tabular-nums text-muted-foreground">
            7be90d1
          </span>
          <span className="min-w-0 flex-1 truncate text-row text-foreground">
            Stream rows in batches of 500
          </span>
          <span className="shrink-0 text-meta text-faint-foreground">29 Sep</span>
        </li>
      </ul>
    </main>
  );
};
