import type { ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';

import type { ChangelogCatchUp } from '../../changelogCatchUp';
import type { ReleaseEntry } from '../../parseChangelog';
import { ReleaseList } from './ReleaseList';

type Props = {
  readonly releases: ReadonlyArray<ReleaseEntry>;
  readonly selectedVersion: string | null;
  readonly installedVersion: string | null;
  readonly dates: Readonly<Record<string, string>>;
  readonly header: ReactNode;
  readonly results: ReactNode | null;
  readonly catchUp: ChangelogCatchUp | null;
  readonly isCatchUpSelected: boolean;
  readonly onSelect: (version: string) => void;
  readonly onSelectCatchUp: () => void;
};

export const ChangelogRail = ({
  releases,
  selectedVersion,
  installedVersion,
  dates,
  header,
  results,
  catchUp,
  isCatchUpSelected,
  onSelect,
  onSelectCatchUp,
}: Props) => (
  <nav className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Releases">
    {header}
    <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
      <div className="flex flex-col gap-2 px-3 pb-3">
        {results ?? (
          <ReleaseList
            releases={releases}
            selectedVersion={selectedVersion}
            installedVersion={installedVersion}
            dates={dates}
            catchUp={catchUp}
            isCatchUpSelected={isCatchUpSelected}
            onSelect={onSelect}
            onSelectCatchUp={onSelectCatchUp}
          />
        )}
      </div>
    </ScrollFade>
  </nav>
);
