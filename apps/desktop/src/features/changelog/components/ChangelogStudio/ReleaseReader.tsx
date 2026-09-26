import type { ReactNode } from 'react';
import { PaneShell } from '../../../../shared/components/PaneShell';
import type { ChangelogScreen } from '../../changelogScreens';
import type { ReleaseEntry } from '../../parseChangelog';
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
}: Props) => (
  <PaneShell scroll="body" title={`Goodboy ${release.version}`} actions={action}>
    <ReleaseBody
      release={release}
      dateLabel={dateLabel}
      installedVersion={installedVersion}
      onOpenScreen={onOpenScreen}
    />
  </PaneShell>
);
