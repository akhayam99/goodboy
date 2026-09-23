import { useShallow } from 'zustand/react/shallow';
import { ArrowUpCircle } from 'lucide-react';
import { Chip, cn } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { UpdateConfirm } from '../UpdateConfirm';
import type { UpdateFailure, UpdateProgress } from '../../../../store/slices/updater/state';

type Props = {
  readonly variant: 'bar' | 'pip';
  readonly onOpenChangelog?: () => void;
};

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

export const UpdateIndicator = ({ variant, onOpenChangelog }: Props) => {
  const { status, version, failure, progress } = useAppStore(
    useShallow((s) => ({
      status: s.updaterStatus,
      version: s.updateVersion,
      failure: s.updateFailure,
      progress: s.updateProgress,
    })),
  );
  if (status !== 'available' && status !== 'downloading') {
    return null;
  }

  const downloading = status === 'downloading';
  const installFailed = !downloading && failure?.phase === 'install';
  const targetVersion = version ?? 'latest';
  const label = chipLabel({ downloading, installFailed, targetVersion, progress });
  const title = chipTitle({ downloading, failure: installFailed ? failure : null, targetVersion });

  const chip = ({ onClick }: { onClick?: () => void }) => (
    <Chip
      as="button"
      tone={installFailed ? 'danger' : 'primary'}
      emphasis="strong"
      shape={variant === 'pip' ? 'pill' : 'badge'}
      icon={<ArrowUpCircle size={11} aria-hidden />}
      label={label}
      onClick={onClick}
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

  if (downloading) {
    return chip({});
  }

  return (
    <UpdateConfirm
      onOpenChangelog={onOpenChangelog}
      trigger={({ arm }) => chip({ onClick: arm })}
    />
  );
};
