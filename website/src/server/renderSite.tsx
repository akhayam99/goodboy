import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from '../App';
import { FeaturesPage } from '../pages/features/FeaturesPage';
import { injectPage } from './injectPage';

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
      html: renderToString(
        <StrictMode>
          <FeaturesPage />
        </StrictMode>,
      ),
    }),
  },
];
