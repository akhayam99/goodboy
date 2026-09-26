import { PaneShell } from '../../../../shared/components/PaneShell';
import type { ChangelogCatchUp } from '../../changelogCatchUp';
import { ReleaseBody } from './ReleaseBody';

type Props = {
  readonly catchUp: ChangelogCatchUp;
  readonly dates: Readonly<Record<string, string>>;
  readonly installedVersion: string | null;
};

export const CatchUpReader = ({ catchUp, dates, installedVersion }: Props) => (
  <PaneShell
    scroll="body"
    title="What's new"
    meta={`Since ${catchUp.fromVersion} · ${catchUp.releases.length} releases`}
  >
    <div className="flex flex-col gap-8">
      {catchUp.releases.map((release) => (
        <div key={release.version} className="flex flex-col gap-5">
          <h2 className="text-sm font-semibold text-foreground">Goodboy {release.version}</h2>
          <ReleaseBody
            release={release}
            dateLabel={dates[release.version] ?? null}
            installedVersion={installedVersion}
            featureHeadingLevel={3}
          />
        </div>
      ))}
    </div>
  </PaneShell>
);
