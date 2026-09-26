import { useEffect, useRef } from 'react';
import { useToast } from '../../../../app/components/Toast';
import { useAppStore } from '../../../../store';
import { changelogCatchUp } from '../../changelogCatchUp';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';
import { releaseSummary } from '../../releaseSummary';

type Props = {
  readonly onOpenChangelog: () => void;
};

export const ReleaseNoticeBridge = ({ onOpenChangelog }: Props) => {
  const isHydrated = useAppStore((state) => state.changelogSeenHydrated);
  const seenVersion = useAppStore((state) => state.changelogSeenVersion);
  const releases = useAppStore((state) => state.changelogReleases);
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
    const catchUp = changelogCatchUp({ releases, seenVersion, installedVersion });
    const installedRelease = releases.find((release) =>
      isInstalledRelease({ tag: release.version, installed: installedVersion }),
    );
    const message =
      installedRelease === undefined ? '' : releaseSummary({ release: installedRelease });
    const actionLabel =
      catchUp === null ? 'Read the changelog' : `What's new since ${catchUp.fromVersion}`;
    previewNotification({
      severity: 'info',
      persist: true,
      title: `Updated to ${installedVersion}`,
      message,
      action: {
        label: actionLabel,
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
    releases,
    markChangelogSeen,
    focusChangelogRelease,
    previewNotification,
  ]);

  return null;
};
