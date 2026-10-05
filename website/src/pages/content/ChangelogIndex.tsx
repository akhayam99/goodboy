import { SITE } from '../../site';
import { ContentPage } from './ContentPage';
import type { Crumb } from './Breadcrumbs';
import { formatDate } from './formatDate';

export type ReleaseSummary = {
  readonly version: string;
  readonly date: string;
  readonly summary: string;
};

type Props = {
  readonly crumbs: readonly Crumb[];
  readonly releases: readonly ReleaseSummary[];
};

export const ChangelogIndex = ({ crumbs, releases }: Props) => (
  <ContentPage
    crumbs={crumbs}
    title="Changelog"
    lead="What each Goodboy release adds, improves and fixes, newest first."
    links={
      <>
        <a className="refLink" href={SITE.changelogFeed}>
          Feed
        </a>
        <a className="refLink" href={SITE.changelogSource}>
          Full history on GitHub
        </a>
      </>
    }
  >
    <ol className="cpList">
      {releases.map((release) => (
        <li key={release.version} className="cpItem">
          <h2 className="cpItemTitle">
            <a href={SITE.release(release.version)}>Goodboy {release.version}</a>
          </h2>
          <time className="cpItemMeta" dateTime={release.date}>
            {formatDate(release.date)}
          </time>
          <p className="cpItemText">{release.summary}</p>
        </li>
      ))}
    </ol>
  </ContentPage>
);
