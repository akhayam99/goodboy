import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpCircle } from 'lucide-react';
import { Button, Chip, Dialog, cn } from '@goodboy/ui';
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
  const targetVersion = version ?? 'latest';
  const title = downloading
    ? `Downloading ${targetVersion}. Goodboy restarts when it finishes`
    : `Update to ${targetVersion}`;
  const confirm = () => {
    setConfirmOpen(false);
    void installUpdate();
  };

  const trigger = (
    <Chip
      as="button"
      tone="primary"
      shape={variant === 'pip' ? 'pill' : 'badge'}
      icon={<ArrowUpCircle size={11} aria-hidden />}
      label={downloading ? `Updating to ${targetVersion}…` : `Update to ${targetVersion}`}
      onClick={() => setConfirmOpen(true)}
      disabled={downloading}
      title={title}
      className={cn('pointer-events-auto relative', downloading && 'animate-border-pulse')}
    />
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
