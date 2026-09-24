import { useEffect, useRef } from 'react';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';

type Props = {
  readonly onOpenChangelog: () => void;
};

export const ReleaseNoticeBridge = ({ onOpenChangelog }: Props) => {
  const isHydrated = useAppStore((state) => state.changelogSeenHydrated);
  const seenVersion = useAppStore((state) => state.changelogSeenVersion);
  const markChangelogSeen = useAppStore((state) => state.markChangelogSeen);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const installedVersion = useInstalledVersion();
  const { previewNotification } = useToast();
  const shownVersion = useRef<string | null>(null);
  const openRef = useRef(onOpenChangelog);
  openRef.current = onOpenChangelog;

  useEffect(() => {
    if (!isHydrated || installedVersion === null || installedVersion.trim() === '') {
      return;
    }
    if (seenVersion === null) {
      void markChangelogSeen({ version: installedVersion });
      return;
    }
    if (isInstalledRelease({ tag: seenVersion, installed: installedVersion })) {
      return;
    }
    if (shownVersion.current === installedVersion) {
      return;
    }
    shownVersion.current = installedVersion;
    previewNotification({
      severity: 'info',
      persist: true,
      title: `Updated to ${installedVersion}`,
      message: 'The release notes list what changed.',
      action: {
        label: 'Read the changelog',
        onClick: () => {
          focusChangelogRelease({ version: installedVersion });
          openRef.current();
        },
      },
      onDismiss: () => {
        void markChangelogSeen({ version: installedVersion });
      },
    });
  }, [
    isHydrated,
    installedVersion,
    seenVersion,
    markChangelogSeen,
    focusChangelogRelease,
    previewNotification,
  ]);

  return null;
};
