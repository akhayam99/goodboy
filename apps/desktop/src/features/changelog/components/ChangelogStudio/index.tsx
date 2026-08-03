import { useEffect, useState } from 'react';
import { ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '../../../../shared/components/StudioRailLayout';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../store';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';
import { resolveChangelogView } from '../../resolveChangelogView';
import { ChangelogRail } from './ChangelogRail';
import { ReleaseDetail } from './ReleaseDetail';

type Props = {
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const ChangelogStudio = ({ workspaceName, onClose }: Props) => {
  const releases = useAppStore((state) => state.changelogReleases);
  const status = useAppStore((state) => state.changelogStatus);
  const error = useAppStore((state) => state.changelogError);
  const fetchedAt = useAppStore((state) => state.changelogFetchedAt);
  const loadChangelog = useAppStore((state) => state.loadChangelog);
  const reloadChangelog = useAppStore((state) => state.reloadChangelog);
  const installedVersion = useInstalledVersion();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    void loadChangelog();
  }, [loadChangelog]);

  const view = resolveChangelogView({ status, releaseCount: releases.length });
  const selected =
    releases.find((release) => release.version === selectedVersion) ?? releases[0] ?? null;
  const isStale = status === 'error' && releases.length > 0;
  const retry = () => {
    void reloadChangelog();
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.changelog}
      tone={CONCEPT_TONE.changelog}
      title="Changelog"
      workspaceName={workspaceName}
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
            />
          }
        />
      )}
    </StudioShell>
  );
};
