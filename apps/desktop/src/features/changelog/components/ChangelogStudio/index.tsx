import { useEffect, useState } from 'react';
import { Button, ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';
import type { ReleaseNote } from '../../changelog';
import { UpdateConfirm } from '../../../updater/components/UpdateConfirm';
import { resolveChangelogView } from '../../resolveChangelogView';
import { ChangelogRail } from './ChangelogRail';
import { ReleaseDetail } from './ReleaseDetail';

type PickReleaseParams = {
  readonly releases: ReadonlyArray<ReleaseNote>;
  readonly selectedVersion: string | null;
  readonly focusVersion: string | null;
  readonly installedVersion: string | null;
};

const sameVersion = ({ tag, version }: { tag: string; version: string | null }): boolean =>
  isInstalledRelease({ tag, installed: version });

export const pickRelease = ({
  releases,
  selectedVersion,
  focusVersion,
  installedVersion,
}: PickReleaseParams): ReleaseNote | null =>
  releases.find((release) => release.version === selectedVersion) ??
  releases.find((release) => sameVersion({ tag: release.version, version: focusVersion })) ??
  releases.find((release) => sameVersion({ tag: release.version, version: installedVersion })) ??
  releases[0] ??
  null;

type Props = {
  readonly onClose: () => void;
};

export const ChangelogStudio = ({ onClose }: Props) => {
  const releases = useAppStore((state) => state.changelogReleases);
  const status = useAppStore((state) => state.changelogStatus);
  const error = useAppStore((state) => state.changelogError);
  const fetchedAt = useAppStore((state) => state.changelogFetchedAt);
  const loadChangelog = useAppStore((state) => state.loadChangelog);
  const reloadChangelog = useAppStore((state) => state.reloadChangelog);
  const markChangelogSeen = useAppStore((state) => state.markChangelogSeen);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const updateVersion = useAppStore((state) =>
    state.updaterStatus === 'available' ? state.updateVersion : null,
  );
  const installedVersion = useInstalledVersion();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const focusAtOpen = useAppStore((state) => state.changelogFocusVersion);
  const [focusVersion] = useState(focusAtOpen);

  useEffect(() => {
    void loadChangelog();
  }, [loadChangelog]);

  useEffect(() => {
    focusChangelogRelease({ version: null });
  }, [focusChangelogRelease]);

  const installedReleaseIsLoaded =
    installedVersion != null &&
    releases.some((release) =>
      isInstalledRelease({ tag: release.version, installed: installedVersion }),
    );

  useEffect(() => {
    if (installedVersion == null) {
      return;
    }
    if (status !== 'ready') {
      return;
    }
    if (!installedReleaseIsLoaded) {
      return;
    }
    void markChangelogSeen({ version: installedVersion });
  }, [installedVersion, installedReleaseIsLoaded, markChangelogSeen, status]);

  const view = resolveChangelogView({ status, releaseCount: releases.length });
  const selected = pickRelease({ releases, selectedVersion, focusVersion, installedVersion });
  const updateRelease =
    updateVersion !== null &&
    selected !== null &&
    sameVersion({ tag: selected.version, version: updateVersion })
      ? updateVersion
      : null;
  const updateAction =
    updateRelease === null ? undefined : (
      <UpdateConfirm
        trigger={({ arm }) => (
          <Button variant="primary" size="sm" onClick={arm}>
            Download and restart
          </Button>
        )}
      />
    );
  const isStale = status === 'error' && releases.length > 0;
  const retry = () => {
    void reloadChangelog();
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.changelog}
      tone={CONCEPT_TONE.changelog}
      title="Changelog"
      {...(installedVersion !== null && { subtitle: `Installed ${installedVersion}` })}
      closeLabel="close changelog"
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Releases"
          railWidth="narrow"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
              <ChangelogRail
                releases={releases}
                selectedVersion={selected?.version ?? null}
                installedVersion={installedVersion}
                isLoading={view === 'loading'}
                onSelect={setSelectedVersion}
              />
            </ScrollFade>
          }
          detail={
            <ReleaseDetail
              release={selected}
              view={view}
              staleError={isStale && error != null ? new Error(error) : null}
              staleSince={isStale ? fetchedAt : null}
              onRetry={retry}
              action={updateAction}
            />
          }
        />
      )}
    </StudioShell>
  );
};
