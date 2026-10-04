import { StrictMode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { App } from '../App';
import { FeaturesPage } from '../pages/features/FeaturesPage';
import { Footer } from '../sections/Footer';
import { Nav } from '../sections/Nav';
import { changelogFeed } from './changelogFeed';
import { CONTENT_PAGES, type ContentPageEntry } from './CONTENT_PAGES';
import { injectPage } from './injectPage';
import { pageHead } from './pageHead';
import { RELEASES } from './RELEASES';
import { STATIC_PAGES } from './STATIC_PAGES';

export type SiteTemplates = {
  readonly home: string;
  readonly features: string;
  readonly content: string;
};

export type SiteFile = {
  readonly path: string;
  readonly content: string;
};

type Params = {
  readonly templates: SiteTemplates;
};

type ContentParams = {
  readonly template: string;
  readonly entry: ContentPageEntry;
};

const renderContentPage = ({ template, entry }: ContentParams): SiteFile => {
  const nav = renderToString(
    <StrictMode>
      <Nav current={entry.nav} />
    </StrictMode>,
  );
  const body = renderToStaticMarkup(
    <>
      {entry.element}
      <Footer />
    </>,
  );
  return {
    path: entry.file,
    content: injectPage({
      template,
      head: pageHead({ page: entry.meta }),
      html: `<div id="nav-root" class="navRoot" data-nav="${entry.nav}">${nav}</div>${body}`,
    }),
  };
};

export const renderSite = ({ templates }: Params): readonly SiteFile[] => [
  {
    path: 'index.html',
    content: injectPage({
      template: templates.home,
      head: pageHead({ page: STATIC_PAGES.home }),
      html: renderToString(
        <StrictMode>
          <App />
        </StrictMode>,
      ),
    }),
  },
  {
    path: 'features.html',
    content: injectPage({
      template: templates.features,
      head: pageHead({ page: STATIC_PAGES.features }),
      html: renderToString(
        <StrictMode>
          <FeaturesPage />
        </StrictMode>,
      ),
    }),
  },
  ...CONTENT_PAGES.map((entry) => renderContentPage({ template: templates.content, entry })),
  { path: 'changelog.xml', content: changelogFeed({ releases: RELEASES }) },
];
