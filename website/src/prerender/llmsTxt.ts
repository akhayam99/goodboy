import { SITE } from '../lib/site';
import { escapeLinkText } from './escapeLinkText';
import type { PageKind, PageMeta } from './PageMeta';

const LATEST_RELEASES = 10;

type Params = {
  readonly pages: readonly PageMeta[];
};

type SectionParams = {
  readonly title: string;
  readonly pages: readonly PageMeta[];
};

type EntryParams = {
  readonly page: PageMeta;
};

type KindsParams = {
  readonly pages: readonly PageMeta[];
  readonly kinds: readonly PageKind[];
};

const entry = ({ page }: EntryParams) =>
  `- [${escapeLinkText({ text: page.title })}](${SITE.origin}${page.path}): ${page.description}`;

const section = ({ title, pages }: SectionParams) => [
  `## ${title}`,
  ...pages.map((page) => entry({ page })),
  '',
];

const ofKinds = ({ pages, kinds }: KindsParams) =>
  pages.filter((page) => page.isIndexed && kinds.includes(page.kind));

export const llmsTxt = ({ pages }: Params) => {
  const home = pages.find((page) => page.kind === 'home');
  if (home === undefined) {
    throw new Error('the page registry has no home page');
  }
  return [
    '# Goodboy',
    '',
    `> ${home.description}`,
    '',
    ...section({ title: 'Product', pages: ofKinds({ pages, kinds: ['home', 'features'] }) }),
    ...section({ title: 'Docs', pages: ofKinds({ pages, kinds: ['docs-index', 'doc'] }) }),
    ...section({
      title: 'Changelog',
      pages: [
        ...ofKinds({ pages, kinds: ['changelog-index'] }),
        ...ofKinds({ pages, kinds: ['release'] }).slice(0, LATEST_RELEASES),
      ],
    }),
    '## Download',
    `- [Install Goodboy](${SITE.origin}/#install)`,
    `- [All releases](${SITE.releases})`,
    '',
  ].join('\n');
};
