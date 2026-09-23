import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowUpCircle } from 'lucide-react';
import { Button, Chip, Dialog, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import type { UpdateFailure, UpdateProgress } from '../../../../store/slices/updater/state';

type Props = { variant: 'bar' | 'pip' };

type ChipLabelParams = {
  readonly downloading: boolean;
  readonly installFailed: boolean;
  readonly targetVersion: string;
  readonly progress: UpdateProgress | null;
};

type ChipTitleParams = {
  readonly downloading: boolean;
  readonly failure: UpdateFailure | null;
  readonly targetVersion: string;
};

const chipTitle = ({ downloading, failure, targetVersion }: ChipTitleParams) => {
  if (downloading) {
    return `Downloading ${targetVersion}. Goodboy restarts when it finishes`;
  }
  if (failure !== null) {
    return failure.message;
  }
  return `Update to ${targetVersion}`;
};

const chipLabel = ({ downloading, installFailed, targetVersion, progress }: ChipLabelParams) => {
  if (installFailed) {
    return 'Update failed';
  }
  if (!downloading) {
    return `Update to ${targetVersion}`;
  }
  if (progress === null || progress.total === null || progress.total <= 0) {
    return 'Downloading';
  }
  const percent = Math.min(100, Math.floor((progress.downloaded / progress.total) * 100));
  return `Downloading ${percent}%`;
};

export const UpdateIndicator = ({ variant }: Props) => {
  const { status, version, failure, progress, installUpdate } = useAppStore(
    useShallow((s) => ({
      status: s.updaterStatus,
      version: s.updateVersion,
      failure: s.updateFailure,
      progress: s.updateProgress,
      installUpdate: s.installUpdate,
    })),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (status !== 'available' && status !== 'downloading') {
    return null;
  }

  const downloading = status === 'downloading';
  const installFailed = !downloading && failure?.phase === 'install';
  const targetVersion = version ?? 'latest';
  const label = chipLabel({ downloading, installFailed, targetVersion, progress });
  const title = chipTitle({ downloading, failure: installFailed ? failure : null, targetVersion });
  const confirm = () => {
    setConfirmOpen(false);
    void installUpdate();
  };

  const trigger = (
    <Chip
      as="button"
      tone={installFailed ? 'danger' : 'primary'}
      emphasis="strong"
      shape={variant === 'pip' ? 'pill' : 'badge'}
      icon={<ArrowUpCircle size={11} aria-hidden />}
      label={label}
      onClick={() => setConfirmOpen(true)}
      disabled={downloading}
      title={title}
      className={cn(
        'pointer-events-auto relative',
        downloading && 'spin-border spin-border-primary',
        status === 'available' && !installFailed && 'attention-ring',
      )}
      testId="update-indicator"
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
