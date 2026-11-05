import type { ReactElement } from 'react';
import type { Crumb } from '../pages/content/Breadcrumbs';
import { ChangelogIndex } from '../pages/content/ChangelogIndex';
import { DocArticle } from '../pages/content/DocArticle';
import { DocsIndex } from '../pages/content/DocsIndex';
import { NotFound } from '../pages/content/NotFound';
import { ReleaseNotes } from '../pages/content/ReleaseNotes';
import featuresData from '../pages/features/features.data.json';
import type { NavSection } from '../pages/home/sections/Nav';
import { SITE } from '../lib/site';
import { clipText } from './clipText';
import { FEATURE_DOCS, type FeatureDoc } from './FEATURE_DOCS';
import type { PageMeta } from './PageMeta';
import { RELEASES } from './RELEASES';
import { releaseDescription } from './releaseDescription';
import { releaseTitle } from './releaseTitle';
import { renderMarkdown } from './renderMarkdown';
import { STATIC_PAGES } from './STATIC_PAGES';
import { stripComments } from './stripComments';

export type ContentPageEntry = {
  readonly file: string;
  readonly meta: PageMeta;
  readonly nav: NavSection;
  readonly element: ReactElement;
};

const LATEST_DATE = RELEASES[0]?.date ?? '';
const HOME: Crumb = { name: 'Home', path: '/' };
const CHANGELOG: Crumb = { name: 'Changelog', path: SITE.changelog };
const DOCS: Crumb = { name: 'Docs', path: SITE.docs };

const SEARCH_HINTS: Readonly<Record<string, string>> = {
  providers: 'Claude Code, Codex and Cursor plan limits',
  workflows: 'run several coding agents on one task',
  workspace: 'repos and git worktrees for coding agents',
  agents: 'talk to and steer coding agents',
  context: 'one brief every coding agent reads',
  review: 'turn review comments into commits',
  artifacts: 'artifacts coding agents write',
  board: 'see every coding agent task by stage',
  'branch-history': 'fold, reword and drop git commits',
  inbox: 'issues from your trackers in one list',
  keyboard: 'a shell in the git worktree and shortcuts',
  overview: 'what a coding agent session did',
  search: 'find any session, message or plan',
  security: 'keep tokens out, back up, update safely',
  setup: 'from install to your first coding agent',
  start: 'begin from an issue, a workflow or a question',
  storage: 'free disk space and clean up branches',
  support: 'report a bug from inside the app',
  switching: 'move between tasks without losing your place',
};

const CLUSTER_OF_AREA = new Map(
  featuresData.clusters.flatMap((cluster) =>
    cluster.guides.map((guide) => [guide.area, cluster.id] as const),
  ),
);

const docTitle = (doc: FeatureDoc) => {
  const hint = SEARCH_HINTS[doc.area];
  return hint === undefined ? `${doc.title} | Goodboy docs` : `${doc.title}: ${hint}`;
};

const SHORT_INTRO = 110;

const docDescription = (doc: FeatureDoc) => {
  const topics = doc.headings.slice(0, 4).join(', ');
  if (doc.intro === '') {
    return clipText(`${doc.title} in Goodboy: ${topics} and more.`);
  }
  return clipText(
    doc.intro.length < SHORT_INTRO && topics !== '' ? `${doc.intro} Covers ${topics}.` : doc.intro,
  );
};

const changelogIndex = (): ContentPageEntry => {
  const crumbs = [HOME, CHANGELOG];
  return {
    file: 'changelog.html',
    meta: {
      path: SITE.changelog,
      title: 'Goodboy changelog: what changed in each release',
      description:
        'Every Goodboy release, newest first: what it adds, improves and fixes when you run Claude Code, Codex and Cursor agents on your tasks.',
      ogType: 'website',
      pageType: 'CollectionPage',
      crumbs,
      lastmod: LATEST_DATE,
      isIndexed: true,
    },
    nav: 'changelog',
    element: <ChangelogIndex crumbs={crumbs} releases={RELEASES} />,
  };
};

const releasePages = (): readonly ContentPageEntry[] =>
  RELEASES.map((release, index) => {
    const path = SITE.release(release.version);
    const crumbs = [HOME, CHANGELOG, { name: `Goodboy ${release.version}`, path }];
    return {
      file: `changelog/${release.version}.html`,
      meta: {
        path,
        title: releaseTitle({ version: release.version, summary: release.summary }),
        description: clipText(
          releaseDescription({
            version: release.version,
            date: release.date,
            summary: release.summary,
            notes: stripComments({ source: release.notes }),
          }),
        ),
        ogType: 'article',
        pageType: 'WebPage',
        crumbs,
        lastmod: release.date,
        isIndexed: true,
      },
      nav: 'changelog',
      element: (
        <ReleaseNotes
          crumbs={crumbs}
          release={release}
          notesHtml={renderMarkdown({ source: release.notes, directory: '' })}
          newer={RELEASES[index - 1] ?? null}
          older={RELEASES[index + 1] ?? null}
        />
      ),
    };
  });

const docsIndex = (): ContentPageEntry => {
  const crumbs = [HOME, DOCS];
  return {
    file: 'docs.html',
    meta: {
      path: SITE.docs,
      title: 'Goodboy docs: a guide to running coding agents with Goodboy',
      description:
        'How each part of Goodboy works: setup, providers, workflows, git worktrees, review, the board, storage and security, one area per page.',
      ogType: 'website',
      pageType: 'CollectionPage',
      crumbs,
      lastmod: LATEST_DATE,
      isIndexed: true,
    },
    nav: 'docs',
    element: <DocsIndex crumbs={crumbs} docs={FEATURE_DOCS} />,
  };
};

const docPages = (): readonly ContentPageEntry[] =>
  FEATURE_DOCS.map((doc, index) => {
    const path = SITE.doc(doc.area);
    const crumbs = [HOME, DOCS, { name: doc.title, path }];
    return {
      file: `docs/${doc.area}.html`,
      meta: {
        path,
        title: docTitle(doc),
        description: docDescription(doc),
        ogType: 'article',
        pageType: 'WebPage',
        crumbs,
        lastmod: LATEST_DATE,
        isIndexed: true,
      },
      nav: 'docs',
      element: (
        <DocArticle
          crumbs={crumbs}
          doc={doc}
          bodyHtml={renderMarkdown({ source: doc.body, directory: 'docs/features' })}
          clusterId={CLUSTER_OF_AREA.get(doc.area) ?? null}
          previous={FEATURE_DOCS[index - 1] ?? null}
          next={FEATURE_DOCS[index + 1] ?? null}
        />
      ),
    };
  });

const notFound = (): ContentPageEntry => ({
  file: '404.html',
  meta: STATIC_PAGES.notFound,
  nav: 'none',
  element: <NotFound />,
});

export const CONTENT_PAGES: readonly ContentPageEntry[] = [
  changelogIndex(),
  ...releasePages(),
  docsIndex(),
  ...docPages(),
  notFound(),
];
