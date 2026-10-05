// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const FEATURES = join(SRC, 'features');
const WORKSPACE = 'features/session/components/SessionWorkspace/index.tsx';

const WIDTH_ALLOWLIST = new Set(['features/chat/components/ImageLightbox/index.tsx']);

const NARROW_ALLOWLIST = new Set([
  'features/chat/components/HandoffChip/index.tsx',
  'features/workspace/components/StageBoard/index.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
]);

type Forbidden = {
  readonly pattern: RegExp;
  readonly allowed: ReadonlySet<string>;
};

const NO_EXCEPTION: ReadonlySet<string> = new Set();

const FORBIDDEN_WIDTHS: ReadonlyArray<Forbidden> = [
  { pattern: /\bmax-w-\[(?!72ch\])\d+ch\]/, allowed: NO_EXCEPTION },
  { pattern: /PANE_RHYTHM\.measure/, allowed: NO_EXCEPTION },
  { pattern: /DIFF_CAPPED_COLUMN_CLASS/, allowed: NO_EXCEPTION },
  { pattern: /\bmax-w-(3xl|4xl|5xl|6xl|7xl)\b/, allowed: NO_EXCEPTION },
  { pattern: /\bmax-w-(2xl|xl)\b/, allowed: NARROW_ALLOWLIST },
];

type RootKind = 'shell' | 'bare' | 'dispatch' | 'helper';

type Root = {
  readonly kind: RootKind;
  readonly files: ReadonlyArray<string>;
};

const SHELL = /<PaneShell\b/;
const CRUMB = /PageCrumb|SessionCrumbs/;

const LENS_ROOTS: Readonly<Record<string, Root>> = {
  SessionOverviewPane: {
    kind: 'shell',
    files: ['features/session/components/SessionOverviewPane/index.tsx'],
  },
  SessionOverviewLoading: {
    kind: 'bare',
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
      'features/artifacts/components/ArtifactList/index.tsx',
      'features/artifacts/components/ArtifactCreationPane/index.tsx',
      'features/artifacts/components/ArtifactShell/ArtifactDocumentShell.tsx',
      'features/artifacts/components/ArtifactShell/ArtifactGenerationShell.tsx',
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
  BranchPage: {
    kind: 'shell',
    files: ['features/branch/components/BranchPage/index.tsx'],
  },
  GithubTaskDetail: {
    kind: 'shell',
    files: [
      'features/session/components/SessionWorkspace/parts/IntegrationPane/GithubTaskDetail.tsx',
    ],
  },
  SessionStudioLayer: {
    kind: 'bare',
    files: ['features/session/components/SessionWorkspace/parts/SessionStudioLayer.tsx'],
  },
  PaneShell: { kind: 'helper', files: [] },
  TrailBar: { kind: 'helper', files: [] },
  FirstLapBanner: { kind: 'helper', files: [] },
  SessionCrumbs: { kind: 'helper', files: [] },
  Pane: { kind: 'helper', files: [] },
  ScriptsPanel: {
    kind: 'shell',
    files: ['features/scripts/components/ScriptsPanel/index.tsx'],
  },
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
      return FORBIDDEN_WIDTHS.filter(
        ({ pattern, allowed }) => !allowed.has(key) && pattern.test(source),
      ).map(({ pattern }) => `${key} uses ${pattern.source}`);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps the allowed narrow widths to files that still use one', () => {
    const stale = [...NARROW_ALLOWLIST].filter((key) => !/\bmax-w-(2xl|xl)\b/.test(read(key)));

    expect(stale).toEqual([]);
  });

  it('puts the workspace chat header, thread and composer on the page column', () => {
    const files = [
      'features/workspace-chat/components/ChatRoom/ChatHeader.tsx',
      'features/workspace-chat/components/ChatRoom/ChatThread.tsx',
      'features/workspace-chat/components/ChatRoom/index.tsx',
    ];

    expect(files.filter((file) => !/<PageColumn\b/.test(read(file)))).toEqual([]);
    expect(read('features/workspace-chat/components/ChatComposer/index.tsx')).not.toMatch(/max-w-/);
  });

  it('classifies every component the session workspace mounts', () => {
    const source = read(WORKSPACE);
    const mounted = [...source.matchAll(/(?<![\w.])<([A-Z][A-Za-z]+)\b/g)]
      .map((match) => match[1] ?? '')
      .filter((name) => name !== '' && name !== 'UnderTrailContext');
    const unknown = [...new Set(mounted)].filter((name) => LENS_ROOTS[name] === undefined);

    expect(unknown).toEqual([]);
  });

  it('renders every lens root through PaneShell, and no root draws a crumb of its own', () => {
    const drifted = Object.entries(LENS_ROOTS).flatMap(([name, root]) =>
      root.files.flatMap((file) => {
        const source = read(file);
        if (CRUMB.test(source)) {
          return [`${name}: ${file} draws a crumb`];
        }
        if (root.kind === 'bare') {
          return [];
        }
        return SHELL.test(source) ? [] : [`${name}: ${file}`];
      }),
    );

    expect(drifted).toEqual([]);
  });
});
