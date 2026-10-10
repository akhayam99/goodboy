// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import type { SessionStudio, StudioKind } from '../../store';
import { STUDIO_META } from '../../app/components/StudioFrame/studioMeta';

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

const FIXED_PX_ALLOWLIST: ReadonlySet<string> = new Set([
  'features/palette/paletteModes.ts',
  'features/onboarding/OnboardingWizard/WizardFrame.tsx',
]);

const CENTRED_ALLOWLIST: ReadonlySet<string> = new Set([
  'features/workspace/components/StageBoard/index.tsx',
  'features/companion/components/CompanionStudio/index.tsx',
  'features/onboarding/OnboardingWizard/steps/ProjectsStep.tsx',
]);

const FORBIDDEN_WIDTHS: ReadonlyArray<Forbidden> = [
  { pattern: /\bmax-w-\[\d+ch\]/, allowed: NO_EXCEPTION },
  { pattern: /\bmax-w-\[\d+px\]/, allowed: FIXED_PX_ALLOWLIST },
  { pattern: /\bmax-w-\[(2[4-9]|[3-9]\d|\d{3,})rem\]/, allowed: NO_EXCEPTION },
  { pattern: /\bmx-auto\b/, allowed: CENTRED_ALLOWLIST },
  { pattern: /PANE_RHYTHM\.(measure|column)\b/, allowed: NO_EXCEPTION },
  {
    pattern: /\bmax-w-\[var\(--(column-max|column-frame|measure-frame)\)\]/,
    allowed: NO_EXCEPTION,
  },
  { pattern: /DIFF_CAPPED_COLUMN_CLASS/, allowed: NO_EXCEPTION },
  { pattern: /\bmax-w-(3xl|4xl|5xl|6xl|7xl)\b/, allowed: NO_EXCEPTION },
  { pattern: /\bmax-w-(2xl|xl)\b/, allowed: NARROW_ALLOWLIST },
];

type RootKind = 'shell' | 'bare' | 'dispatch' | 'helper' | 'banner';

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
  AskTrailButton: { kind: 'helper', files: [] },
  FirstLapBanner: {
    kind: 'banner',
    files: [
      'features/bootstrap/FirstLapBanner/index.tsx',
      'features/bootstrap/MoveCard/index.tsx',
      'features/bootstrap/MoveReport/index.tsx',
    ],
  },
  SessionCrumbs: { kind: 'helper', files: [] },
  Pane: { kind: 'helper', files: [] },
  ScriptsPanel: {
    kind: 'shell',
    files: ['features/scripts/components/ScriptsPanel/index.tsx'],
  },
  LinkIssueAction: { kind: 'helper', files: [] },
  EmptyState: { kind: 'helper', files: [] },
};

type PlaceRoots = Readonly<Record<string, ReadonlyArray<string>>>;

const STUDIO_ROOTS: Readonly<Record<StudioKind, ReadonlyArray<string>>> = {
  settings: [
    'features/settings/components/SettingsStudio/AppScopePanel.tsx',
    'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx',
  ],
  guide: ['features/settings/components/GuideStudio/parts/GuideContent.tsx'],
  companion: ['features/companion/components/CompanionStudio/index.tsx'],
  addWorkspace: ['features/workspace/components/WorkspaceLinkStudio/index.tsx'],
  workflow: ['features/workflows/components/WorkflowsPanel/index.tsx'],
  inbox: ['features/inbox/components/InboxStudio/index.tsx'],
  impact: [
    'features/impact/components/ImpactStudio/OverviewPanel.tsx',
    'features/impact/components/ImpactStudio/FlowPanel.tsx',
    'features/impact/components/ImpactStudio/SpendPanel.tsx',
    'features/impact/components/ImpactStudio/ShippedPanel.tsx',
  ],
  changelog: [
    'features/changelog/components/ChangelogStudio/ReleaseReader.tsx',
    'features/changelog/components/ChangelogStudio/CatchUpReader.tsx',
  ],
  notifications: ['features/notifications/components/NotificationsStudio/index.tsx'],
  chat: ['features/workspace-chat/components/ChatRoom/index.tsx'],
};

const SESSION_STUDIO_ROOTS: Readonly<Record<SessionStudio['kind'], ReadonlyArray<string>>> = {
  workflow: ['features/workflows/components/WorkflowBuilderView/index.tsx'],
};

const FORM_AND_DETAIL_ROOTS: PlaceRoots = {
  'Runs > Create': ['features/workflows/components/WorkflowBuilderView/index.tsx'],
  'Runs > a run': ['features/session/components/SessionWorkspace/parts/WorkflowRunDetail.tsx'],
  'Questions detail': ['features/session/components/SessionWorkspace/parts/QuestionsPane.tsx'],
  'Branch > create pull request': [
    'features/integrations/github/components/PullRequest/CreatePrPanel.tsx',
  ],
  'Create merge request': [
    'features/integrations/gitlab/MergeRequest/MrDetailPanel/CreateMrForm.tsx',
  ],
  'Artifacts > create': ['features/artifacts/components/ArtifactCreationPane/index.tsx'],
  'Session overview loading': [
    'features/session/components/SessionWorkspace/parts/SessionOverviewSkeleton.tsx',
  ],
  'Add workspace': ['features/workspace/components/WorkspaceLinkStudio/index.tsx'],
};

const COLUMN_ROOT = /<(PaneShell|PageColumn|FormPage)\b/;

const STUDIO_TIERS: Readonly<Record<StudioKind, 'column' | 'full'>> = {
  settings: 'column',
  guide: 'column',
  companion: 'full',
  addWorkspace: 'column',
  workflow: 'column',
  inbox: 'column',
  impact: 'column',
  changelog: 'column',
  notifications: 'column',
  chat: 'full',
};

const H1_ALLOWLIST: ReadonlySet<string> = new Set([
  'features/artifacts/components/ArtifactShell/ArtifactShellHeader.tsx',
  'features/artifacts/components/ArtifactList/index.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
  'features/session/components/SessionDraftPane/SessionDraftHeader.tsx',
  'shared/components/StudioDetail/RecordHeader/index.tsx',
]);

const TITLE_ROW_PAGES: ReadonlyArray<string> = [
  'features/session/components/SessionOverviewPane/HeaderBand.tsx',
  'features/session/components/AgentDetailPane/AgentHeader.tsx',
  'features/session/components/AgentTree/RunHeader/index.tsx',
  'features/workspace/components/StageBoard/index.tsx',
];

const UI_COMPONENTS = join(SRC, '..', '..', '..', 'packages/ui/src/components');

const titleRowTags = (source: string): ReadonlyArray<string> =>
  [...source.matchAll(/data-slot="pane-title-row"/g)].map((match) => {
    const at = match.index ?? 0;
    return source.slice(source.lastIndexOf('<div', at), source.indexOf('>', at));
  });

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

  it('keeps every exception list to files that still need it', () => {
    const stalePx = [...FIXED_PX_ALLOWLIST].filter((key) => !/\bmax-w-\[\d+px\]/.test(read(key)));
    const staleCentred = [...CENTRED_ALLOWLIST].filter((key) => !/\bmx-auto\b/.test(read(key)));

    expect([...stalePx, ...staleCentred]).toEqual([]);
  });

  it('reads prose at one measure and keeps every column on the shared frame variables', () => {
    const styles = read('styles.css');

    expect(styles).toMatch(/--measure:\s*720px;/);
    expect(styles).toMatch(/--measure-frame:\s*calc\(var\(--measure\) \+ 48px\);/);
    const prose = walk(FEATURES)
      .map(toKey)
      .filter((key) => /max-w-\[var\(--measure\)\]/.test(read(key)));
    expect(prose.length).toBeGreaterThan(0);
  });

  it('centres column and measure in PageColumn alone, never full, never per view', () => {
    const source = readFileSync(
      join(SRC, '..', '..', '..', 'packages/ui/src/components/PageColumn.tsx'),
      'utf8',
    );

    expect(source).toMatch(/column: `mx-auto max-w-\[var\(--column-frame\)\]/);
    expect(source).toMatch(/measure: `mx-auto max-w-\[var\(--measure-frame\)\]/);
    expect(source).toMatch(/full: GUTTER_CLASS,/);
    const centred = walk(FEATURES)
      .map(toKey)
      .filter((key) => /\bmx-auto\b/.test(read(key)) && !CENTRED_ALLOWLIST.has(key));
    expect(centred).toEqual([]);
  });

  it('puts the Ask button inside the trail column, on the same rail as the crumbs', () => {
    const source = read('features/session/components/SessionWorkspace/parts/TrailBar.tsx');
    const column = source.slice(source.indexOf('<PageColumn'), source.indexOf('</PageColumn>'));

    expect(column).toContain('{end}');
    expect(column).toContain('<SessionCrumbs');
    expect(source.slice(source.indexOf('</PageColumn>'))).not.toContain('{end}');
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

  it('registers every studio and session studio, so a new place cannot skip the contract', () => {
    const meta = read('app/components/StudioFrame/studioMeta.ts');
    const studios = [...meta.matchAll(/^ {2}(\w+): \{$/gm)].map((match) => match[1] ?? '').sort();
    const types = read('store/slices/session-view/types.ts');
    const start = types.indexOf('export type SessionStudio =');
    const declaration = types.slice(start, types.indexOf('\n\n', start));
    const sessionStudios = [...declaration.matchAll(/kind: '(\w+)'/g)]
      .map((match) => match[1] ?? '')
      .sort();

    expect(Object.keys(STUDIO_ROOTS).sort()).toEqual(studios);
    expect(Object.keys(SESSION_STUDIO_ROOTS).sort()).toEqual(sessionStudios);
  });

  it('roots every studio, session studio, form and sub-page on a PageColumn, never a left pinned wrapper', () => {
    const places: PlaceRoots = {
      ...Object.fromEntries(
        Object.entries(STUDIO_ROOTS).map(([kind, files]) => [`studio ${kind}`, files]),
      ),
      ...Object.fromEntries(
        Object.entries(SESSION_STUDIO_ROOTS).map(([kind, files]) => [
          `session studio ${kind}`,
          files,
        ]),
      ),
      ...FORM_AND_DETAIL_ROOTS,
    };
    const unrooted = Object.entries(places).flatMap(([place, files]) =>
      files.flatMap((file) =>
        COLUMN_ROOT.test(read(file)) || CENTRED_ALLOWLIST.has(file) ? [] : [`${place}: ${file}`],
      ),
    );

    expect(unrooted).toEqual([]);
  });

  it('centres the form page and the studio skeleton through PageColumn', () => {
    const formPage = readFileSync(
      join(SRC, '..', '..', '..', 'packages/ui/src/components/FormPage.tsx'),
      'utf8',
    );

    expect(formPage).toMatch(/<PageColumn>/);
    expect(formPage).not.toMatch(/PANE_RHYTHM|max-w-/);
    expect(read('app/components/StudioFrame/StudioSkeleton.tsx')).toMatch(/<PageColumn\b/);
  });

  it('gives every studio a tier, and puts only the rail studios that align to the gutter on full', () => {
    const tiers = Object.fromEntries(
      Object.entries(STUDIO_META).map(([kind, meta]) => [kind, meta.tier]),
    );

    expect(tiers).toEqual(STUDIO_TIERS);
    expect(Object.keys(STUDIO_TIERS).sort()).toEqual(Object.keys(STUDIO_ROOTS).sort());
  });

  it('draws the studio band inside a PageColumn, never on its own gutter', () => {
    const source = read('shared/components/StudioShell/StudioBand.tsx');
    const header = source.slice(source.indexOf('<header'), source.indexOf('</header>'));

    expect(header).toMatch(/<header[^>]*>\s*<PageColumn\b/);
    expect(header).toContain('width={width}');
    expect(header).not.toMatch(/\bpx-\d/);
    expect(read('app/components/StudioFrame/index.tsx')).toContain('width={meta.tier}');
  });

  it('hands the studio frame the under-trail context so no studio title sits lower than a session title', () => {
    const source = read('app/components/StudioFrame/index.tsx');

    expect(source).toMatch(/<UnderTrailContext\.Provider value>\{children\}/);
  });

  it('renders every h1 through the title row primitive, outside the few dialogs and documents', () => {
    const offenders = walk(SRC)
      .map(toKey)
      .filter((key) => key.endsWith('.tsx') && !key.startsWith('app/components/MockScene/'))
      .filter((key) => /<h1\b/.test(read(key)) && !H1_ALLOWLIST.has(key))
      .filter((key) => !TITLE_ROW_PAGES.includes(key))
      .filter((key) => key !== 'features/workspace-chat/components/ChatRoom/ChatHeader.tsx');

    expect(offenders).toEqual([]);
    const stale = [...H1_ALLOWLIST].filter((key) => !/<h1\b/.test(read(key)));
    expect(stale).toEqual([]);
  });

  it('draws the title row of every own-header page as a fixed, centred, single line', () => {
    const drifted = TITLE_ROW_PAGES.flatMap((file) => {
      const tags = titleRowTags(read(file));
      if (tags.length === 0) {
        return [`${file} has no title row`];
      }
      return tags.flatMap((tag) => {
        const problems: Array<string> = [];
        if (!/\b(min-)?h-8\b/.test(tag)) {
          problems.push(`${file} title row is not 32px`);
        }
        if (!/items-center/.test(tag)) {
          problems.push(`${file} title row does not centre`);
        }
        if (/flex-wrap|items-baseline|items-start/.test(tag)) {
          problems.push(`${file} title row wraps or aligns off centre`);
        }
        return problems;
      });
    });

    expect(drifted).toEqual([]);
    const primitive = readFileSync(join(UI_COMPONENTS, 'PaneShell/PaneTitleRow.tsx'), 'utf8');
    const bandPrimitive = readFileSync(join(UI_COMPONENTS, 'HeaderBand.tsx'), 'utf8');
    expect(titleRowTags(primitive)[0]).toMatch(/\bh-8\b.*items-center|items-center.*\bh-8\b/);
    expect(titleRowTags(bandPrimitive)[0]).toMatch(/\bh-8\b.*items-center|items-center.*\bh-8\b/);
  });

  it('keeps the first lap, move card and move report on the column as notices, never a bar of their own', () => {
    const files = LENS_ROOTS['FirstLapBanner']?.files ?? [];

    expect(files.filter((file) => !/<Notice\b/.test(read(file)))).toEqual([]);
    expect(files.filter((file) => /bg-subtle|px-4 py-3/.test(read(file)))).toEqual([]);
    const workspace = read(WORKSPACE);
    const trailEnd = workspace.indexOf('<TrailBar');
    const region = workspace.slice(trailEnd, workspace.indexOf('<UnderTrailContext.Provider'));
    expect(region).not.toContain('FirstLapBanner');
    expect(workspace).toMatch(/const banner = <FirstLapBanner sessionId=\{sessionId\} \/>;/);
    const shell = readFileSync(join(UI_COMPONENTS, 'PaneShell/index.tsx'), 'utf8');
    expect(shell).toContain('PaneBannerContext');
  });

  it('classifies every component the session workspace mounts', () => {
    const source = read(WORKSPACE);
    const mounted = [...source.matchAll(/(?<![\w.])<([A-Z][A-Za-z]+)\b/g)]
      .map((match) => match[1] ?? '')
      .filter(
        (name) => name !== '' && name !== 'UnderTrailContext' && name !== 'PaneBannerContext',
      );
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
        if (root.kind === 'bare' || root.kind === 'banner') {
          return [];
        }
        return SHELL.test(source) ? [] : [`${name}: ${file}`];
      }),
    );

    expect(drifted).toEqual([]);
  });
});
