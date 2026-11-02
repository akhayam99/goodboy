import { useEffect, useState, type ReactNode } from 'react';
import { StudioRailLayout, useStudioRailFold } from '@goodboy/ui';
import { StudioDetail } from '../../../../shared/components/StudioShell/StudioDetail';
import { useAppStore } from '../../../../store';
import { changelogCatchUp } from '../../changelogCatchUp';
import { isInstalledRelease } from '../../isInstalledRelease';
import { useInstalledVersion } from '../../hooks/useInstalledVersion';
import type { ReleaseEntry } from '../../parseChangelog';
import type { ChangelogScreen } from '../../changelogScreens';
import { UpdateActions } from '../../../updater/components/UpdateActions';
import { updateCardStateOf } from '../../../updater/updateCardState';
import { ChangelogRail } from './ChangelogRail';
import { CatchUpReader } from './CatchUpReader';
import { ReleaseReader } from './ReleaseReader';
import { releaseDateLabel } from '../../releaseDateLabel';
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

const pickRelease = ({
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

export type ReleaseRequest = {
  readonly version: string;
  readonly nonce: number;
};

type Props = {
  readonly header: ReactNode;
  readonly results: ReactNode | null;
  readonly request: ReleaseRequest | null;
  readonly onOpenScreen: (params: { readonly screen: ChangelogScreen }) => void;
};

export const WhatsNewTab = ({ header, results, request, onOpenScreen }: Props) => {
  const fold = useStudioRailFold({ surface: 'changelog' });
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
    updateCardStateOf({
      status: state.updaterStatus,
      failure: state.updateFailure,
      isQueued: state.updateQueuedUntilIdle,
      runningCount: 0,
    }) === null
      ? null
      : state.updateVersion,
  );
  const installedVersion = useInstalledVersion();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(request?.version ?? null);
  const focusAtOpen = useAppStore((state) => state.changelogFocusVersion);
  const [focusVersion] = useState(focusAtOpen);
  const [isCatchUpSelected, setIsCatchUpSelected] = useState(
    () =>
      request === null &&
      (focusAtOpen === null ||
        updateTarget === null ||
        !sameVersion({ tag: focusAtOpen, version: updateTarget })),
  );

  useEffect(() => {
    if (request === null) {
      return;
    }
    setSelectedVersion(request.version);
    setIsCatchUpSelected(false);
  }, [request]);

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
  const selected = pickRelease({
    releases,
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
  const updateAction = updateRelease === null ? undefined : <UpdateActions />;

  const selectRelease = (version: string): void => {
    setSelectedVersion(version);
    setIsCatchUpSelected(false);
  };

  const selectCatchUp = (): void => {
    setIsCatchUpSelected(true);
  };

  const isCatchUpShown = catchUp !== null && isCatchUpSelected;

  return (
    <StudioRailLayout
      railLabel="Releases"
      railWidth="standard"
      surface="changelog"
      placement="page"
      isCollapsed={fold.isCollapsed}
      onCollapsedChange={fold.setFolded}
      rail={
        <ChangelogRail
          releases={releases}
          selectedVersion={isCatchUpShown ? null : (selected?.version ?? null)}
          installedVersion={installedVersion}
          dates={dates}
          header={header}
          results={results}
          catchUp={catchUp}
          isCatchUpSelected={isCatchUpShown}
          onSelect={selectRelease}
          onSelectCatchUp={selectCatchUp}
        />
      }
      detail={
        <StudioDetail>
          {isCatchUpShown && catchUp !== null ? (
            <CatchUpReader catchUp={catchUp} dates={dates} installedVersion={installedVersion} />
          ) : selected !== null ? (
            <ReleaseReader
              release={selected}
              dateLabel={releaseDateLabel({ publishedAt: dates[selected.version] })}
              installedVersion={installedVersion}
              onOpenScreen={onOpenScreen}
              action={updateAction}
            />
          ) : null}
        </StudioDetail>
      }
    />
  );
};
