import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpCircle, Loader2 } from 'lucide-react';
import { Button, Dialog, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';

type Props = { variant: 'bar' | 'pip' };

export const UpdateIndicator = ({ variant }: Props) => {
  const { status, version, installUpdate } = useAppStore(
    useShallow((s) => ({
      status: s.updaterStatus,
      version: s.updateVersion,
      installUpdate: s.installUpdate,
    })),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (status !== 'available' && status !== 'downloading') {
    return null;
  }

  const downloading = status === 'downloading';
  const title = downloading
    ? 'Downloading update. Goodboy restarts when it finishes'
    : `Update available${version ? ` (${version})` : ''}`;
  const Icon = downloading ? Loader2 : ArrowUpCircle;

  const confirm = () => {
    setConfirmOpen(false);
    void installUpdate();
  };

  const trigger =
    variant === 'pip' ? (
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={downloading}
        title={title}
        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-2xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
      >
        <Icon size={11} className={cn(downloading && 'motion-safe:animate-spin')} aria-hidden />
        <span>{downloading ? 'updating…' : 'update'}</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        disabled={downloading}
        title={title}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
      >
        <Icon size={11} className={cn(downloading && 'motion-safe:animate-spin')} aria-hidden />
        <span>{downloading ? 'Updating…' : 'Update'}</span>
      </button>
    );

  return (
    <>
      {trigger}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Install update?"
        description={version ? `A new version (${version}) is ready.` : 'A new version is ready.'}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
              Not now
            </Button>
            <Button variant="primary" size="sm" onClick={confirm}>
              Update and restart
            </Button>
          </>
        }
      >
        <p className="leading-relaxed text-muted-foreground">
          Goodboy will restart to finish installing. Any running sessions are interrupted, so save
          your work before continuing.
        </p>
      </Dialog>
    </>
  );
};
