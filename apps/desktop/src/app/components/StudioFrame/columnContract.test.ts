// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import type { StudioKind } from '../../../store';
import { PAGE_FRAME, PAGE_MEASURE, frameTierOf } from '@goodboy/ui';
import { STUDIO_META } from './studioMeta';

const SRC = join(__dirname, '..', '..', '..');
const FEATURES = join(SRC, 'features');
const WORKSPACE = 'features/session/components/SessionWorkspace/index.tsx';

const WIDTH_ALLOWLIST = new Set(['shared/components/ImageLightbox/index.tsx']);

const NARROW_ALLOWLIST = new Set([
  'features/chat/components/HandoffChip/HandoffCardShell.tsx',
  'features/workspace/components/StageBoard/index.tsx',
]);

type Forbidden = {
  readonly pattern: RegExp;
  readonly allowed: ReadonlySet<string>;
};

const NO_EXCEPTION: ReadonlySet<string> = new Set();

const FIXED_PX_ALLOWLIST: ReadonlySet<string> = new Set([
  'features/palette/paletteModes.ts',
  'features/onboarding/OnboardingWizard/WizardFrame.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
]);

const CENTRED_ALLOWLIST: ReadonlySet<string> = new Set([
  'features/workspace/components/StageBoard/index.tsx',
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
  OrchestratedRunPage: {
    kind: 'shell',
    files: ['features/session/components/OrchestratedRun/index.tsx'],
  },
  IntegrationPane: {
    kind: 'shell',
    files: ['features/session/components/SessionWorkspace/parts/IntegrationPane/index.tsx'],
  },
  FilesPane: {
    kind: 'shell',
    files: [
      'features/session/components/SessionWorkspace/parts/FilesPane.tsx',
      'features/session/components/SessionWorkspace/parts/FileVersionsPane/index.tsx',
      'features/session/components/SessionWorkspace/parts/ChangesPane/index.tsx',
    ],
  },
  ArtifactStudio: {
    kind: 'dispatch',
    files: [
      'features/artifacts/components/ArtifactList/index.tsx',
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
  PresetRunPage: {
    kind: 'shell',
    files: [
      'features/session/components/PresetRun/RunOverviewPage.tsx',
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
  PaneShell: { kind: 'helper', files: [] },
  StudioBandContext: { kind: 'helper', files: [] },
  FirstLapBanner: {
    kind: 'banner',
    files: [
      'features/bootstrap/FirstLapBanner/index.tsx',
      'features/bootstrap/MoveCard/index.tsx',
      'features/bootstrap/MoveReport/index.tsx',
    ],
  },
  SessionTrail: { kind: 'helper', files: [] },
  Pane: { kind: 'helper', files: [] },
  LinkIssueAction: { kind: 'helper', files: [] },
  EmptyState: { kind: 'helper', files: [] },
};

type PlaceRoots = Readonly<Record<string, ReadonlyArray<string>>>;

const STUDIO_ROOTS: Readonly<Record<StudioKind, ReadonlyArray<string>>> = {
  settings: [
    'features/settings/components/SettingsStudio/AppScopePanel.tsx',
    'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx',
  ],
  guide: ['features/settings/components/GuideStudio/parts/ChapterPage.tsx'],
  addWorkspace: ['features/workspace/components/WorkspaceLinkStudio/index.tsx'],
  workflow: ['features/workflows/components/WorkflowsPanel/index.tsx'],
  inbox: ['features/inbox/components/InboxStudio/index.tsx'],
  terminal: ['features/terminal/components/TerminalStudio/index.tsx'],
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
  monitoring: ['features/monitoring/components/MonitoringStudio/MonitoringPage.tsx'],
};

const FORM_AND_DETAIL_ROOTS: PlaceRoots = {
  'Runs > a run': ['features/session/components/OrchestratedRun/index.tsx'],
  'Questions detail': ['features/session/components/SessionWorkspace/parts/QuestionsPane.tsx'],
  'Branch > create pull request': ['features/branch/components/BranchPage/index.tsx'],
  'Create merge request': ['features/integrations/gitlab/MergeRequest/MrDetailPanel/index.tsx'],
  'Session overview loading': [
    'features/session/components/SessionWorkspace/parts/SessionOverviewSkeleton.tsx',
  ],
  'Add workspace': ['features/workspace/components/WorkspaceLinkStudio/index.tsx'],
};

const COLUMN_ROOT = /<(PaneShell|PageColumn|PageSkeleton|FormPage)\b/;

const PAGELESS_STUDIOS: ReadonlySet<string> = new Set(['addWorkspace']);

const FULL_BLEED_PLACES: ReadonlySet<string> = new Set(['studio terminal']);

const SPLIT_DETAIL_FILES: Readonly<Partial<Record<StudioKind, ReadonlyArray<string>>>> = {
  guide: ['features/settings/components/GuideStudio/index.tsx'],
  changelog: ['features/changelog/components/ChangelogStudio/index.tsx'],
  chat: ['features/workspace-chat/components/ChatStudio.tsx'],
  inbox: ['features/inbox/components/InboxStudio/InboxStudioLayout.tsx'],
  notifications: ['features/notifications/components/NotificationsStudio/index.tsx'],
};

const H1_ALLOWLIST: ReadonlySet<string> = new Set([
  'features/artifacts/components/ArtifactShell/ArtifactShellHeader.tsx',
  'features/artifacts/components/ArtifactList/index.tsx',
  'features/workspace/components/WorkspaceLauncher/index.tsx',
  'shared/components/StudioDetail/RecordHeader/index.tsx',
]);

const TITLE_ROW_PAGES: ReadonlyArray<string> = [
  'features/session/components/AgentDetailPane/AgentHeader.tsx',
  'features/workspace-chat/components/ChatRoom/ChatHeader.tsx',
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

  it('keeps the session tools out of the page header, with no trail band', () => {
    const source = read(WORKSPACE);

    expect(source).not.toContain('PaneActionsContext');
    expect(source).not.toContain('PaneCluster');
    expect(source).not.toContain('TrailBar');
  });

  it('puts the workspace chat header, thread and composer on the page column', () => {
    const files = [
      'features/workspace-chat/components/ChatRoom/ChatHeader.tsx',
      'features/workspace-chat/components/ChatRoom/ChatThread.tsx',
      'features/workspace-chat/components/ChatRoom/index.tsx',
    ];

    expect(files.filter((file) => !/<(PageColumn|PageHeader)\b/.test(read(file)))).toEqual([]);
    expect(read('features/workspace-chat/components/ChatComposer/index.tsx')).not.toMatch(/max-w-/);
  });

  it('puts the agent transcript, its composer and the rows above it on the 720 measure, no exception', () => {
    const files = [
      'features/chat/components/ChatView/index.tsx',
      'features/chat/components/ChatInput/index.tsx',
      'features/chat/components/ChatView/parts/WorkflowAdvanceStack/index.tsx',
    ];

    expect(PAGE_MEASURE.agent).toBe('measure');
    expect(read('features/chat/components/ConversationColumn.tsx')).toMatch(
      /<PageColumn\s+width=\{PAGE_MEASURE\.agent\}/,
    );
    expect(files.filter((file) => !/<ConversationColumn\b/.test(read(file)))).toEqual([]);
    expect(files.filter((file) => /<PageColumn\b/.test(read(file)))).toEqual([]);
    expect(read('features/workflows/components/WorkflowAdvance/index.tsx')).toMatch(
      /<PageColumn\s+width=\{PAGE_MEASURE\.agent\}/,
    );
    const styling = readFileSync(join(SRC, '..', '..', '..', 'docs', 'styling.md'), 'utf8');
    expect(styling).not.toMatch(/A conversation is the exception/);
  });

  it('registers every studio, so a new place cannot skip the contract', () => {
    const meta = read('app/components/StudioFrame/studioMeta.ts');
    const studios = [...meta.matchAll(/^ {2}(\w+): \{$/gm)].map((match) => match[1] ?? '').sort();

    expect(Object.keys(STUDIO_ROOTS).sort()).toEqual(studios);
  });

  it('roots every studio, form and sub-page on a PageColumn, never a left pinned wrapper', () => {
    const places: PlaceRoots = {
      ...Object.fromEntries(
        Object.entries(STUDIO_ROOTS).map(([kind, files]) => [`studio ${kind}`, files]),
      ),
      ...FORM_AND_DETAIL_ROOTS,
    };
    const unrooted = Object.entries(places).flatMap(([place, files]) =>
      files.flatMap((file) =>
        COLUMN_ROOT.test(read(file)) || CENTRED_ALLOWLIST.has(file) || FULL_BLEED_PLACES.has(place)
          ? []
          : [`${place}: ${file}`],
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
    expect(read('app/components/StudioFrame/StudioSkeleton.tsx')).toMatch(/<PageSkeleton\b/);
  });

  it('agrees every studio tier with the frame type of its page', () => {
    const disagreeing = Object.entries(STUDIO_META).flatMap(([kind, meta]) =>
      meta.page === null || meta.tier === frameTierOf({ type: PAGE_FRAME[meta.page] })
        ? []
        : [`${kind}: tier ${meta.tier} is not the tier of ${PAGE_FRAME[meta.page]}`],
    );
    const untyped = Object.entries(STUDIO_META).flatMap(([kind, meta]) =>
      meta.page === null && !PAGELESS_STUDIOS.has(kind) ? [kind] : [],
    );

    expect(disagreeing).toEqual([]);
    expect(untyped).toEqual([]);
    expect(Object.keys(STUDIO_META).sort()).toEqual(Object.keys(STUDIO_ROOTS).sort());
  });

  it('draws every split studio detail through StudioDetail, so the crumb sits beside the rail', () => {
    const splitStudios = Object.entries(STUDIO_META).filter(
      ([, meta]) => meta.page !== null && PAGE_FRAME[meta.page] === 'split',
    );
    const missing = Object.values(SPLIT_DETAIL_FILES).flatMap((files) =>
      files.filter((file) => !/<StudioDetail>/.test(read(file))),
    );

    expect(splitStudios.map(([kind]) => kind).sort()).toEqual(
      Object.keys(SPLIT_DETAIL_FILES).sort(),
    );
    expect(missing).toEqual([]);
  });

  it('draws the studio band inside a PageColumn, never on its own gutter', () => {
    const source = read('shared/components/StudioShell/StudioBand.tsx');
    const header = source.slice(source.indexOf('<header'), source.indexOf('</header>'));

    expect(header).toMatch(/<header[^>]*>\s*<PageColumn\b/);
    expect(header).toContain('width={width}');
    expect(header).not.toMatch(/\bpx-\d/);
  });

  it('hands the studio frame the under-trail context so no studio title sits lower than a session title', () => {
    const source = read('app/components/StudioFrame/index.tsx');

    expect(source).toMatch(
      /<UnderTrailContext\.Provider value=\{isUnderTrail\}>\s*\{children\}\s*<\/UnderTrailContext\.Provider>/,
    );
    expect(source).toMatch(
      /<UnderTrailContext\.Provider value=\{isUnderTrail\}>\s*\{drawerSpec\.node\}\s*<\/UnderTrailContext\.Provider>/,
    );
    expect(source).toMatch(/const isUnderTrail = isBandDrawn \|\| isOuterUnderTrail;/);
    expect(source).toMatch(/const isOuterUnderTrail = useContext\(UnderTrailContext\);/);
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
    expect(workspace).toMatch(/const banner = <FirstLapBanner sessionId=\{sessionId\} \/>;/);
    const shell = readFileSync(join(UI_COMPONENTS, 'PaneShell/index.tsx'), 'utf8');
    expect(shell).toContain('PaneBannerContext');
  });

  it('classifies every component the session workspace mounts', () => {
    const source = read(WORKSPACE);
    const mounted = [...source.matchAll(/(?<![\w.])<([A-Z][A-Za-z]+)\b/g)]
      .map((match) => match[1] ?? '')
      .filter(
        (name) =>
          name !== '' &&
          name !== 'UnderTrailContext' &&
          name !== 'PaneBannerContext' &&
          name !== 'PageTrailContext' &&
          name !== 'PaneActionsContext',
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
