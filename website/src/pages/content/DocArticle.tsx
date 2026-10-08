import { SITE } from '../../site';
import type { Crumb } from './Breadcrumbs';
import { ContentPage } from './ContentPage';
import type { DocSummary } from './DocsIndex';
import { Pager, type PagerLink } from './Pager';
import { Prose } from './Prose';

type Props = {
  readonly crumbs: readonly Crumb[];
  readonly doc: DocSummary;
  readonly bodyHtml: string;
  readonly clusterId: string | null;
  readonly previous: DocSummary | null;
  readonly next: DocSummary | null;
};

const pagerLink = (
  label: string,
  direction: PagerLink['direction'],
  doc: DocSummary | null,
): readonly PagerLink[] =>
  doc === null ? [] : [{ label, direction, title: doc.title, href: SITE.doc(doc.area) }];

export const DocArticle = ({ crumbs, doc, bodyHtml, clusterId, previous, next }: Props) => (
  <ContentPage
    crumbs={crumbs}
    title={doc.title}
    lead={doc.intro === '' ? undefined : doc.intro}
    links={
      <>
        {clusterId === null ? null : (
          <a className="refLink" href={`${SITE.features}#${clusterId}`}>
            See it on the features page
          </a>
        )}
        <a className="refLink" href={SITE.featureDoc(doc.area)}>
          View on GitHub
        </a>
      </>
    }
  >
    <Prose html={bodyHtml} />
    <Pager
      label="More guides"
      links={[...pagerLink('Previous', 'back', previous), ...pagerLink('Next', 'forward', next)]}
    />
  </ContentPage>
);
