import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const FEATURES = join(SRC, 'features');
const WORKSPACE = 'features/session/components/SessionWorkspace/index.tsx';

const WIDTH_ALLOWLIST = new Set(['features/chat/components/ImageLightbox/index.tsx']);

const FORBIDDEN_WIDTHS: ReadonlyArray<RegExp> = [
  /PANE_RHYTHM\.measure/,
  /DIFF_CAPPED_COLUMN_CLASS/,
  /\bmax-w-(3xl|4xl|5xl|6xl|7xl)\b/,
];

type RootKind = 'shell' | 'legacy' | 'dispatch' | 'helper';

type Root = {
  readonly kind: RootKind;
  readonly files: ReadonlyArray<string>;
};

const SHELL = /<PaneShell\b|<FocusedPane\b/;
const LEGACY = /<PageCrumbRow\b/;

const LENS_ROOTS: Readonly<Record<string, Root>> = {
  SessionOverviewPane: {
    kind: 'shell',
    files: ['features/session/components/SessionOverviewPane/index.tsx'],
  },
  SessionOverviewLoading: {
    kind: 'legacy',
    files: ['features/session/components/SessionWorkspace/parts/SessionOverviewLoading.tsx'],
  },
  QuestionsPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/QuestionsPane.tsx'],
  },
  WorkflowsPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/WorkflowsPane.tsx'],
  },
  ContextPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/ContextPane/index.tsx'],
  },
  IntegrationPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/IntegrationPane/index.tsx'],
  },
  ExplorePane: { kind: 'shell', files: ['features/explore/components/ExplorePane/index.tsx'] },
  AgentsPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/AgentsPane.tsx'],
  },
  FilesPane: {
    kind: 'shell',
    files: [
      'features/session/components/SessionWorkspace/parts/FilesPane.tsx',
      'features/session/components/SessionWorkspace/parts/FileVersionsPane/index.tsx',
    ],
  },
  TerminalDock: { kind: 'shell', files: ['features/terminal/components/TerminalDock/index.tsx'] },
  ArtifactStudio: {
    kind: 'dispatch',
    files: [
      'features/artifacts/components/ArtifactStudio/ArtifactCollection.tsx',
      'features/artifacts/components/ArtifactCreationPane/index.tsx',
      'features/plans/components/PlanStudio/index.tsx',
    ],
  },
  ArtifactStudioDetails: {
    kind: 'legacy',
    files: [
      'features/artifacts/components/ArtifactStudio/ArtifactDetail.tsx',
      'features/artifacts/components/ArtifactStudio/ArtifactRunDetail.tsx',
    ],
  },
  AgentOverlay: {
    kind: 'shell',
    files: [
      'features/session/components/SessionWorkspace/parts/AgentOverlay.tsx',
      'features/session/components/AgentDetailPane/index.tsx',
    ],
  },
  PrPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/PrPane.tsx'],
  },
  ReviewPane: {
    kind: 'shell',
    files: [
      'features/review/components/ReviewPane/index.tsx',
      'features/resolve/components/ResolveQueueHome/index.tsx',
    ],
  },
  GithubTaskDetail: {
    kind: 'shell',
    files: [
      'features/session/components/SessionWorkspace/parts/IntegrationPane/GithubTaskDetail.tsx',
    ],
  },
  SessionStudioLayer: {
    kind: 'legacy',
    files: ['features/session/components/SessionWorkspace/parts/SessionStudioLayer.tsx'],
  },
  PaneShell: { kind: 'helper', files: [] },
  SessionCrumbs: { kind: 'helper', files: [] },
  Pane: { kind: 'helper', files: [] },
  ScriptsPanel: { kind: 'helper', files: [] },
  LinkTicketPopover: { kind: 'helper', files: [] },
  LensEmptyState: { kind: 'helper', files: [] },
};

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) {
      return [];
    }
    return [path];
  });

const toKey = (path: string) => relative(SRC, path).split(sep).join('/');
const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

describe('content column contract', () => {
  it('lets no feature pick its own layout width', () => {
    const offenders = walk(FEATURES).flatMap((path) => {
      const key = toKey(path);
      if (WIDTH_ALLOWLIST.has(key)) {
        return [];
      }
      const source = readFileSync(path, 'utf8');
      return FORBIDDEN_WIDTHS.filter((pattern) => pattern.test(source)).map(
        (pattern) => `${key} uses ${pattern.source}`,
      );
    });

    expect(offenders).toEqual([]);
  });

  it('classifies every component the session workspace mounts', () => {
    const source = read(WORKSPACE);
    const mounted = [...source.matchAll(/(?<![\w.])<([A-Z][A-Za-z]+)\b/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name !== '' && name !== 'PageCrumbContext');
    const unknown = [...new Set(mounted)].filter((name) => LENS_ROOTS[name] === undefined);

    expect(unknown).toEqual([]);
  });

  it('renders every lens root through PaneShell, or through a crumb-aware wrapper until it moves', () => {
    const drifted = Object.entries(LENS_ROOTS).flatMap(([name, root]) =>
      root.files.flatMap((file) => {
        const source = read(file);
        if (root.kind === 'legacy') {
          return LEGACY.test(source) || SHELL.test(source) ? [] : [`${name}: ${file}`];
        }
        return SHELL.test(source) ? [] : [`${name}: ${file}`];
      }),
    );

    expect(drifted).toEqual([]);
  });
});
