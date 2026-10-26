import { useState } from 'react';
import { GitMerge, GitPullRequestClosed } from 'lucide-react';
import { Button, ConfirmPopover, ICON_SIZE, type ConfirmRole } from '@goodboy/ui';

type Props = {
  readonly role: ConfirmRole;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly triggerLabel: string;
  readonly doneLabel: string;
};

export const HeaderConfirmScene = ({
  role,
  title,
  description,
  confirmLabel,
  triggerLabel,
  doneLabel,
}: Props) => {
  const [isDone, setIsDone] = useState(false);
  const Icon = role === 'danger' ? GitPullRequestClosed : GitMerge;
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
          Settle payouts in the ledger-core export
        </h1>
        {isDone ? (
          <span role="status" className="text-meta text-muted-foreground">
            {doneLabel}
          </span>
        ) : (
          <ConfirmPopover
            role={role}
            icon={<Icon size={ICON_SIZE.row} aria-hidden />}
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            onConfirm={async () => {
              await Promise.resolve();
              setIsDone(true);
            }}
            trigger={({ isArmed, arm }) => (
              <Button
                variant={role === 'danger' ? 'secondary' : 'primary'}
                size="sm"
                aria-expanded={isArmed}
                onClick={arm}
              >
                {triggerLabel}
              </Button>
            )}
          />
        )}
      </header>
      <p data-slot="session-facts" className="text-meta text-muted-foreground">
        Northwind, ledger-core, #318
      </p>
    </main>
  );
};
