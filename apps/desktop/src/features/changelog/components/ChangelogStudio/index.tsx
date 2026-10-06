import { useEffect, useState } from 'react';
import { Button, ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioRailLayout } from '@goodboy/ui';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NAMES } from '../../../../shared/names';
import { useAppStore } from '../../../../store';
import { changelogCatchUp } from '../../changelogCatchUp';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';
import type { ReleaseEntry } from '../../parseChangelog';
import type { ChangelogScreen } from '../../changelogScreens';
import { UpdateConfirm } from '../../../updater/components/UpdateConfirm';
import { ChangelogRail } from './ChangelogRail';
import { CatchUpReader } from './CatchUpReader';
import { ReleaseReader } from './ReleaseReader';
import { searchReleases } from '../../searchReleases';
import { upcomingEntries, withUpcomingReleases } from '../../upcomingReleases';

type PickReleaseParams = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly selectedVersion: string | null;
  readonly focusVersion: string | null;
  readonly installedVersion: string | null;
};

const sameVersion = ({
  tag,
  version,
}: {
  readonly tag: string;
  readonly version: string | null;
}): boolean => isInstalledRelease({ tag, installed: version });

export const pickRelease = ({
  releases,
  selectedVersion,
  focusVersion,
  installedVersion,
}: PickReleaseParams): ReleaseEntry | null =>
  releases.find((release) => release.version === selectedVersion) ??
  releases.find((release) => sameVersion({ tag: release.version, version: focusVersion })) ??
  releases.find((release) => sameVersion({ tag: release.version, version: installedVersion })) ??
  releases[0] ??
  null;

type Props = {
  readonly onClose: () => void;
  readonly onOpenScreen: (params: { readonly screen: ChangelogScreen }) => void;
};

export const ChangelogStudio = ({ onClose, onOpenScreen }: Props) => {
  const bundledReleases = useAppStore((state) => state.changelogReleases);
  const upcoming = useAppStore((state) => state.changelogUpcoming);
  const updateTarget = useAppStore((state) => state.updateVersion);
  const updateNotes = useAppStore((state) => state.updateNotes);
  const loadChangelogUpcoming = useAppStore((state) => state.loadChangelogUpcoming);
  const dates = useAppStore((state) => state.changelogDates);
  const loadChangelogDates = useAppStore((state) => state.loadChangelogDates);
  const seenVersion = useAppStore((state) => state.changelogSeenVersion);
  const markChangelogSeen = useAppStore((state) => state.markChangelogSeen);
  const focusChangelogRelease = useAppStore((state) => state.focusChangelogRelease);
  const updateVersion = useAppStore((state) =>
    state.updaterStatus === 'available' ? state.updateVersion : null,
  );
  const installedVersion = useInstalledVersion();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const focusAtOpen = useAppStore((state) => state.changelogFocusVersion);
  const [focusVersion] = useState(focusAtOpen);
  const [isCatchUpSelected, setIsCatchUpSelected] = useState(
    () =>
      focusAtOpen === null ||
      updateTarget === null ||
      !sameVersion({ tag: focusAtOpen, version: updateTarget }),
  );

  useEffect(() => {
    if (updateTarget === null) {
      return;
    }
    void loadChangelogUpcoming({ target: updateTarget });
  }, [updateTarget, loadChangelogUpcoming]);

  useEffect(() => {
    void loadChangelogDates();
  }, [loadChangelogDates]);

  useEffect(() => {
    focusChangelogRelease({ version: null });
  }, [focusChangelogRelease]);

  useEffect(() => {
    if (installedVersion === null || installedVersion.trim() === '') {
      return;
    }
    void markChangelogSeen({ version: installedVersion });
  }, [installedVersion, markChangelogSeen]);

  const fetchedUpcoming =
    upcoming !== null &&
    updateTarget !== null &&
    sameVersion({ tag: upcoming.target, version: updateTarget })
      ? upcoming.releases
      : [];
  const releases = withUpcomingReleases({
    upcoming: upcomingEntries({
      fetched: fetchedUpcoming,
      notes: updateNotes,
      target: updateTarget,
      installed: installedVersion,
    }),
    releases: bundledReleases,
  });
  const catchUp = changelogCatchUp({ releases, seenVersion, installedVersion });
  const filteredReleases = searchReleases({ releases, query });
  const selected = pickRelease({
    releases: filteredReleases,
    selectedVersion,
    focusVersion,
    installedVersion,
  });
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

  const selectRelease = (version: string): void => {
    setSelectedVersion(version);
    setIsCatchUpSelected(false);
  };

  const selectCatchUp = (): void => {
    setIsCatchUpSelected(true);
  };

  const showCatchUp = catchUp !== null && isCatchUpSelected && query.trim() === '';

  return (
    <StudioShell
      icon={CONCEPT_ICONS.changelog}
      tone={CONCEPT_TONE.changelog}
      title={NAMES.whatsNew}
      {...(installedVersion !== null && { subtitle: `Installed ${installedVersion}` })}
      closeLabel={`Close ${NAMES.whatsNew.toLowerCase()}`}
      onClose={onClose}
    >
      {() => (
        <StudioRailLayout
          railLabel="Releases"
          railWidth="standard"
          surface="changelog"
          placement="page"
          rail={
            <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
              <ChangelogRail
                releases={filteredReleases}
                selectedVersion={showCatchUp ? null : (selected?.version ?? null)}
                installedVersion={installedVersion}
                query={query}
                onQueryChange={setQuery}
                catchUp={catchUp}
                isCatchUpSelected={showCatchUp}
                onSelect={selectRelease}
                onSelectCatchUp={selectCatchUp}
              />
            </ScrollFade>
          }
          detail={
            showCatchUp && catchUp !== null ? (
              <CatchUpReader catchUp={catchUp} dates={dates} installedVersion={installedVersion} />
            ) : selected !== null ? (
              <ReleaseReader
                release={selected}
                dateLabel={dates[selected.version] ?? null}
                installedVersion={installedVersion}
                onOpenScreen={onOpenScreen}
                action={updateAction}
              />
            ) : null
          }
        />
      )}
    </StudioShell>
  );
};
