import { SITE } from '../../site';
import type { Crumb } from './Breadcrumbs';
import { ContentPage } from './ContentPage';

export type DocSummary = {
  readonly area: string;
  readonly title: string;
  readonly intro: string;
};

type Props = {
  readonly crumbs: readonly Crumb[];
  readonly docs: readonly DocSummary[];
};

export const DocsIndex = ({ crumbs, docs }: Props) => (
  <ContentPage
    crumbs={crumbs}
    title="Feature guide"
    lead="How each part of Goodboy works, one area per page."
    links={
      <a className="refLink" href={SITE.featureGuide}>
        Docs on GitHub
      </a>
    }
  >
    <ol className="cpList">
      {docs.map((doc) => (
        <li key={doc.area} className="cpItem">
          <h2 className="cpItemTitle">
            <a href={SITE.doc(doc.area)}>{doc.title}</a>
          </h2>
          {doc.intro === '' ? null : <p className="cpItemText">{doc.intro}</p>}
        </li>
      ))}
    </ol>
  </ContentPage>
);
