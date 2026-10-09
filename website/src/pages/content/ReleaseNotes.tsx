import { SITE } from '../../site';
import type { Crumb } from './Breadcrumbs';
import type { ReleaseSummary } from './ChangelogIndex';
import { ContentPage } from './ContentPage';
import { formatDate } from './formatDate';
import { Pager, type PagerLink } from './Pager';
import { Prose } from './Prose';

type Props = {
  readonly crumbs: readonly Crumb[];
  readonly release: ReleaseSummary;
  readonly notesHtml: string;
  readonly newer: ReleaseSummary | null;
  readonly older: ReleaseSummary | null;
};

const pagerLink = (label: string, release: ReleaseSummary | null): readonly PagerLink[] =>
  release === null
    ? []
    : [{ label, title: `Goodboy ${release.version}`, href: SITE.release(release.version) }];

export const ReleaseNotes = ({ crumbs, release, notesHtml, newer, older }: Props) => (
  <ContentPage
    crumbs={crumbs}
    title={`Goodboy ${release.version}`}
    lead={release.summary}
    links={
      <>
        <time className="cpDate" dateTime={release.date}>
          Released {formatDate(release.date)}
        </time>
        <a className="refLink" href={SITE.releaseTag(release.version)}>
          Release on GitHub
        </a>
      </>
    }
  >
    {notesHtml === '' ? null : <Prose html={notesHtml} />}
    <Pager
      label="More releases"
      links={[...pagerLink('Older', older), ...pagerLink('Newer', newer)]}
    />
  </ContentPage>
);
