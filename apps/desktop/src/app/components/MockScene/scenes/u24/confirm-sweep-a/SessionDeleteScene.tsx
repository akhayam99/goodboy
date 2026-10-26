import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE } from '@goodboy/ui';

const NAME = 'Speed up the payout export';

export const SessionDeleteScene = () => {
  const [isGone, setIsGone] = useState(false);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <header
        data-slot="pane-title-row"
        className="flex h-8 min-w-0 items-center justify-between gap-2"
      >
        <h1 className="min-w-0 truncate text-title text-foreground">
          {isGone ? 'Session deleted' : NAME}
        </h1>
        {isGone ? null : (
          <ConfirmPopover
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
            title={`Delete ${NAME}?`}
            description="Removed: transcript, file versions, images. Kept: branches, cost, uncommitted worktrees."
            confirmLabel="Delete session"
            altAction={{ label: 'Archive instead', onClick: () => setIsGone(true) }}
            onConfirm={async () => {
              await Promise.resolve();
              setIsGone(true);
            }}
            trigger={({ isArmed, arm }) => (
              <Button variant="secondary" size="sm" aria-expanded={isArmed} onClick={arm}>
                Delete
              </Button>
            )}
          />
        )}
      </header>
      <p data-slot="session-facts" className="text-meta text-muted-foreground">
        Northwind, ledger-core, 3 agents
      </p>
    </main>
  );
};
