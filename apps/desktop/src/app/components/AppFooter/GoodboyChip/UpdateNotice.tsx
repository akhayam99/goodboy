import { Button, Notice } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { runningAgentsCopy } from '../../../../features/updater/components/UpdateConfirm';
import { useRunningAgentCount } from '../../../../features/updater/hooks/useRunningAgentCount';

export const UpdateNotice = () => {
  const status = useAppStore((s) => s.updaterStatus);
  const version = useAppStore((s) => s.updateVersion);
  const failure = useAppStore((s) => s.updateFailure);
  const applyUpdate = useAppStore((s) => s.applyUpdate);
  const runningCount = useRunningAgentCount();
  const target = version ?? 'The new version';
  const isDownloading = status === 'downloading';
  const isReady = status === 'ready';
  const hasInstallFailed = !isDownloading && failure?.phase === 'install';

  return (
    <Notice
      tone={hasInstallFailed ? 'danger' : 'info'}
      placement="inline"
      title={
        hasInstallFailed
          ? `Couldn't install ${target}.`
          : `${target} is ${isReady ? 'ready' : 'available'}.`
      }
      body={hasInstallFailed ? failure.message : runningAgentsCopy({ count: runningCount })}
      actions={
        <Button
          size="sm"
          disabled={isDownloading}
          onClick={() => {
            void applyUpdate();
          }}
        >
          {isDownloading
            ? 'Downloading'
            : hasInstallFailed
              ? 'Retry'
              : isReady
                ? 'Restart now'
                : 'Restart to update'}
        </Button>
      }
    />
  );
};
