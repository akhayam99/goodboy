import type { ReactElement } from 'react';
import type { Crumb } from '../pages/content/Breadcrumbs';
import { ChangelogIndex } from '../pages/content/ChangelogIndex';
import { DocArticle } from '../pages/content/DocArticle';
import { DocsIndex } from '../pages/content/DocsIndex';
import { ReleaseNotes } from '../pages/content/ReleaseNotes';
import featuresData from '../pages/features/features.data.json';
import type { NavSection } from '../sections/Nav';
import { SITE } from '../site';
import { clipText } from './clipText';
import { FEATURE_DOCS, type FeatureDoc } from './FEATURE_DOCS';
import type { PageMeta } from './PageMeta';
import { RELEASES } from './RELEASES';
import { renderMarkdown } from './renderMarkdown';

export type ContentPageEntry = {
  readonly file: string;
  readonly meta: PageMeta;
  readonly crumbs: readonly Crumb[];
  readonly nav: NavSection;
  readonly element: ReactElement;
};

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

const docDescription = (doc: FeatureDoc) =>
  clipText(
    doc.intro === ''
      ? `${doc.title} in Goodboy: ${doc.headings.slice(0, 4).join(', ')} and more.`
      : doc.intro,
  );

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
      isIndexed: true,
    },
    crumbs,
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
        title: `Goodboy ${release.version} release notes`,
        description: clipText(release.summary),
        ogType: 'article',
        isIndexed: true,
      },
      crumbs,
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
      isIndexed: true,
    },
    crumbs,
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
        isIndexed: true,
      },
      crumbs,
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

export const CONTENT_PAGES: readonly ContentPageEntry[] = [
  changelogIndex(),
  ...releasePages(),
  docsIndex(),
  ...docPages(),
];
