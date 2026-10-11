import { useState } from 'react';
import { Unplug } from 'lucide-react';
import { Button, ConfirmPopover } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';

export const SignOutScene = () => {
  const [isSignedIn, setIsSignedIn] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  return (
    <main
      data-slot="confirm-sweep-scene"
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-background p-6"
    >
      <div
        data-slot="provider-account-row"
        className="flex h-10 min-w-0 items-center gap-3 rounded-md px-2"
      >
        <span className="w-28 shrink-0 text-label text-muted-foreground">
          {isSignedIn ? 'Signed in' : 'Signed out'}
        </span>
        <span className="min-w-0 flex-1 truncate text-label text-foreground">
          maya@harborline.example · Max plan
        </span>
        {isSignedIn ? (
          <ConfirmPopover
            role="alert"
            icon={<Unplug size={ICON_SIZE.row} aria-hidden />}
            title="Disconnect Claude?"
            description="Signs the CLI out on this machine. Connect again to sign back in."
            confirmLabel="Disconnect"
            isOpen={isOpen}
            onConfirm={async () => {
              await Promise.resolve();
              setIsOpen(false);
              setIsSignedIn(false);
            }}
            onCancel={() => setIsOpen(false)}
            trigger={() => (
              <Button variant="ghost-danger" size="sm" onClick={() => setIsOpen(true)}>
                Disconnect
              </Button>
            )}
          />
        ) : null}
      </div>
    </main>
  );
};
