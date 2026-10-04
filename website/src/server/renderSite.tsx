import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../App';
import { FeaturesPage } from '../pages/features/FeaturesPage';
import { injectPage } from './injectPage';
import { pageHead } from './pageHead';
import { STATIC_PAGES } from './STATIC_PAGES';

export type SiteTemplates = {
  readonly home: string;
  readonly features: string;
};

export type SiteFile = {
  readonly path: string;
  readonly content: string;
};

type Params = {
  readonly templates: SiteTemplates;
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
];
