import { BUILD_ASSET_URLS } from '../data/downloads';
import { SITE } from '../site';
import type { PageMeta } from './PageMeta';
import { RELEASES } from './RELEASES';
import { STATIC_PAGES } from './STATIC_PAGES';

type Params = {
  readonly page: PageMeta;
};

const ROOT_URL = `${SITE.origin}/`;
const ORGANIZATION_ID = `${SITE.origin}/#organization`;
const WEBSITE_ID = `${SITE.origin}/#website`;
const SOFTWARE_ID = `${SITE.origin}/#software`;

const FEATURE_LIST = [
  'A briefing per task: goal, decisions and summary, read by every agent on it',
  'Workflows that run a goal as steps, each a fresh agent with a short brief',
  'Seven providers in one session: Claude, Codex, Cursor, Gemini, OpenCode, OpenRouter, Moonshot',
  'A git worktree for each branch of a task, across several repos',
  'A board that shows which tasks are building, running, in review or need you',
  'A timeline of what ran, what it cost and what was decided',
  'Nine roles, each workflow step with its own provider, model and effort',
  'Plans, reports and wireframes kept next to the task',
  'GitHub, GitLab, Bitbucket, Linear, Jira, Sentry and Slack in one Inbox',
  'Review comments resolved as commits, with replies you approve',
  'Your tasks, decisions and settings stored on your computer, no account',
];

const organization = () => ({
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'Goodboy',
  url: ROOT_URL,
  logo: { '@type': 'ImageObject', url: `${SITE.origin}/favicon.svg` },
  sameAs: [SITE.repo, SITE.x],
});

const website = () => ({
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: 'Goodboy',
  url: ROOT_URL,
  inLanguage: 'en',
  publisher: { '@id': ORGANIZATION_ID },
});

const software = () => {
  const latest = RELEASES[0];
  return {
    '@type': 'SoftwareApplication',
    '@id': SOFTWARE_ID,
    name: 'Goodboy',
    description: STATIC_PAGES.home.description,
    url: ROOT_URL,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'macOS, Linux',
    softwareVersion: latest?.version,
    dateModified: latest?.date,
    releaseNotes:
      latest === undefined ? undefined : `${SITE.origin}${SITE.release(latest.version)}`,
    downloadUrl: Object.values(BUILD_ASSET_URLS),
    installUrl: `${SITE.origin}/#install`,
    image: `${SITE.origin}/og-image.png`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    author: { '@type': 'Person', name: 'Amin Khayam', url: 'https://github.com/akhayam99' },
    publisher: { '@id': ORGANIZATION_ID },
    sameAs: [SITE.repo],
    featureList: FEATURE_LIST,
  };
};

const breadcrumbList = ({ page }: Params) => ({
  '@type': 'BreadcrumbList',
  '@id': `${SITE.origin}${page.path}#breadcrumb`,
  itemListElement: page.crumbs.map((crumb, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: crumb.name,
    item: `${SITE.origin}${crumb.path}`,
  })),
});

const webPage = ({ page }: Params) => {
  const url = `${SITE.origin}${page.path}`;
  return {
    '@type': page.pageType,
    '@id': `${url}#webpage`,
    url,
    name: page.title,
    description: page.description,
    inLanguage: 'en',
    dateModified: page.lastmod,
    isPartOf: { '@id': WEBSITE_ID },
    about: { '@id': SOFTWARE_ID },
    breadcrumb: page.crumbs.length > 1 ? { '@id': `${url}#breadcrumb` } : undefined,
  };
};

export const jsonLd = ({ page }: Params) => {
  const graph = [
    organization(),
    website(),
    software(),
    ...(page.isIndexed ? [webPage({ page })] : []),
    ...(page.isIndexed && page.crumbs.length > 1 ? [breadcrumbList({ page })] : []),
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  return `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`;
};
