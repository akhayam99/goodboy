import { PaneShell } from '@goodboy/ui';
import type { ReactNode } from 'react';
import type { ChangelogScreen } from '../../changelogScreens';
import type { ReleaseEntry } from '../../parseChangelog';
import { releaseMeta } from '../../releaseMeta';
import { uniquePrs } from '../../releasePrs';
import { PrRef } from './PrRef';
import { ReleaseBody } from './ReleaseBody';

type Props = {
  readonly release: ReleaseEntry;
  readonly dateLabel: string | null;
  readonly installedVersion: string | null;
  readonly onOpenScreen?: (params: { readonly screen: ChangelogScreen }) => void;
  readonly action?: ReactNode;
};

export const ReleaseReader = ({
  release,
  dateLabel,
  installedVersion,
  onOpenScreen,
  action,
}: Props) => {
  const prs = uniquePrs({ release });
  return (
    <PaneShell
      page="release"
      scroll="body"
      title={`Goodboy ${release.version}`}
      meta={
        <span className="inline-flex items-center gap-2">
          {releaseMeta({ release, dateLabel, installedVersion })}
          {prs.length === 1 ? <PrRef prs={prs} /> : null}
        </span>
      }
      actions={action}
    >
      <ReleaseBody
        release={release}
        dateLabel={dateLabel}
        installedVersion={installedVersion}
        isMetaShown={false}
        onOpenScreen={onOpenScreen}
      />
    </PaneShell>
  );
};
