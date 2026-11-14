// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import { PAGE_MEASURE, PANE_RHYTHM, type FramePage, type PageColumnWidth } from '@goodboy/ui';
import { STUDIO_META } from './studioMeta';

const SRC = join(__dirname, '..', '..', '..');
const UI = join(SRC, '..', '..', '..', 'packages/ui/src');

type PageRoot = {
  readonly page: FramePage;
  readonly files: ReadonlyArray<string>;
  readonly prop?: string;
};

const DOOR_PAGES: ReadonlyArray<PageRoot> = [
  { page: 'board', files: ['features/workspace/components/StageBoard/SessionsHeader.tsx'] },
  { page: 'inbox', files: ['features/inbox/components/InboxStudio/index.tsx'] },
  { page: 'chat', files: ['features/workspace-chat/components/ChatRoom/ChatHeader.tsx'] },
  { page: 'workflows', files: ['features/workflows/components/WorkflowsPanel/index.tsx'] },
  { page: 'work', files: ['features/work/components/WorkPage/index.tsx'] },
  {
    page: 'terminal',
    files: ['features/terminal/components/TerminalStudio/TerminalStudioBody.tsx'],
  },
  {
    page: 'browser',
    files: ['features/browser/components/BrowserStudio/BrowserPageHeader.tsx'],
  },
  {
    page: 'settings',
    files: [
      'features/settings/components/SettingsStudio/AppScopePanel.tsx',
      'features/settings/components/SettingsStudio/WorkspaceScopePanel.tsx',
    ],
  },
  {
    page: 'monitoring',
    files: ['features/monitoring/components/MonitoringStudio/MonitoringPage.tsx'],
  },
  {
    page: 'notifications',
    files: ['features/notifications/components/NotificationsStudio/index.tsx'],
  },
  {
    page: 'guide',
    files: ['features/settings/components/GuideStudio/parts/ChapterPage.tsx'],
    prop: 'page="guideChapter"',
  },
  {
    page: 'guideChapter',
    files: ['features/settings/components/GuideStudio/parts/ChapterPage.tsx'],
  },
  {
    page: 'settings',
    files: ['features/companion/components/IphonePage/index.tsx'],
  },
  {
    page: 'whatsNew',
    files: ['features/changelog/components/ChangelogStudio/CatchUpReader.tsx'],
  },
  {
    page: 'release',
    files: ['features/changelog/components/ChangelogStudio/ReleaseReader.tsx'],
  },
  {
    page: 'impact',
    files: [
      'features/impact/components/ImpactStudio/OverviewPanel.tsx',
      'features/impact/components/ImpactStudio/ShippedPanel.tsx',
      'features/impact/components/ImpactStudio/FlowPanel.tsx',
      'features/impact/components/ImpactStudio/SpendPanel.tsx',
    ],
  },
];

const SESSION_PAGES: ReadonlyArray<PageRoot> = [
  { page: 'overview', files: ['features/session/components/SessionOverviewPane/index.tsx'] },
  { page: 'runs', files: ['features/session/components/SessionWorkspace/parts/WorkflowsPane.tsx'] },
  {
    page: 'run',
    files: [
      'features/session/components/PresetRun/RunOverviewPage.tsx',
      'features/session/components/OrchestratedRun/index.tsx',
    ],
  },
  {
    page: 'agent',
    files: [
      'features/session/components/AgentDetailPane/index.tsx',
      'features/session/components/SessionWorkspace/parts/AgentOverlay.tsx',
    ],
  },
  { page: 'artifacts', files: ['features/artifacts/components/ArtifactList/index.tsx'] },
  {
    page: 'report',
    files: [
      'features/artifacts/components/ArtifactShell/ArtifactDocumentShell.tsx',
      'features/artifacts/components/ArtifactShell/ArtifactGenerationShell.tsx',
    ],
    prop: 'page=\\{(artifact|generation)\\.kind\\}',
  },
  {
    page: 'questions',
    files: ['features/session/components/SessionWorkspace/parts/QuestionsPane.tsx'],
  },
  { page: 'branch', files: ['features/branch/components/BranchPage/index.tsx'] },
];

const PAGE_KIND_MEASURE: Readonly<Record<string, PageColumnWidth>> = {
  board: 'full',
  inbox: 'column',
  chat: 'measure',
  work: 'column',
  workflows: 'column',
  terminal: 'full',
  browser: 'full',
  settings: 'column',
  monitoring: 'column',
  notifications: 'column',
  guide: 'column',
  guideChapter: 'column',
  whatsNew: 'column',
  release: 'column',
  impact: 'column',
  overview: 'column',
  runs: 'column',
  run: 'column',
  agent: 'measure',
  artifacts: 'column',
  report: 'column',
  questions: 'column',
  branch: 'column',
};

const READING_PAGES: ReadonlySet<FramePage> = new Set<FramePage>(['chat', 'agent']);

const HEADER_FILES: ReadonlyArray<string> = [
  'features/workspace/components/StageBoard/SessionsHeader.tsx',
  'features/workspace-chat/components/ChatRoom/ChatHeader.tsx',
  'features/session/components/AgentDetailPane/AgentHeader.tsx',
  'features/artifacts/components/ArtifactShell/ArtifactShellHeader.tsx',
  'features/branch/components/BranchHeader/index.tsx',
];

const REVEAL_ROOT_OF: Readonly<Partial<Record<FramePage, string>>> = {
  board: 'features/workspace/components/StageBoard/SessionsHeader.tsx',
  chat: 'features/workspace-chat/components/ChatRoom/ChatHeader.tsx',
  terminal: 'features/terminal/components/TerminalStudio/TerminalRail.tsx',
};

const HEADERLESS_VIEW_OF: Readonly<Partial<Record<FramePage, string>>> = {
  browser: 'features/browser/components/BrowserStudio/BrowserPageView.tsx',
};

const SIDE_SCROLLER_FILES: ReadonlyArray<string> = [
  'features/chat/components/ConversationDock/index.tsx',
];

const HEADERLESS_PAGES: ReadonlySet<FramePage> = new Set<FramePage>(['terminal']);

const PAGE_PRIMITIVE = /<(PaneShell|PageHeader)\b/;

const HEADER_PADDING = /\b(pt|py|mt|my)-\d+\b|\bh-10\b/;

const PANE_HEADER_SLOT = /data-slot="pane-header"/;

const SKELETON_BODY_OF: Readonly<Record<keyof typeof STUDIO_META, string>> = {
  settings: 'rows',
  guide: 'prose',
  addWorkspace: 'rows',
  workflow: 'rows',
  work: 'rows',
  inbox: 'rows',
  impact: 'cards',
  changelog: 'prose',
  notifications: 'rows',
  chat: 'room',
  terminal: 'terminal',
  browser: 'rows',
  monitoring: 'rows',
};

const BOARD_SKELETON_PAGES: ReadonlySet<string> = new Set(['board']);

const PAGE_EMPTY_FILES: ReadonlyArray<string> = [
  'features/terminal/components/TerminalStudio/TerminalDetail.tsx',
  'features/workspace-chat/components/ChatStudio.tsx',
  'features/workspace/components/StageBoard/BoardEmpty/index.tsx',
  'features/workspace/components/StageBoard/BlockedBoard/index.tsx',
  'features/session/components/SessionWorkspace/parts/SessionOverviewLoading.tsx',
];

const PAGE_SKELETON_FILES: Readonly<Record<string, string>> = {
  overview: 'features/session/components/SessionWorkspace/parts/SessionOverviewSkeleton.tsx',
  studio: 'app/components/StudioFrame/StudioSkeleton.tsx',
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

const productionFiles = (): ReadonlyArray<string> =>
  walk(SRC)
    .map(toKey)
    .filter((key) => !key.startsWith('app/components/MockScene/'))
    .filter((key) => !key.startsWith('__tests__/'));

const ALL_PAGES = [...DOOR_PAGES, ...SESSION_PAGES];

const propOf = (root: PageRoot): RegExp => new RegExp(root.prop ?? `page="${root.page}"`);

describe('one page layout', () => {
  it('mounts every door page and every session page on the shared page primitive', () => {
    const drifted = ALL_PAGES.flatMap((root) =>
      root.files.flatMap((file) => {
        const source = read(file);
        if (HEADERLESS_PAGES.has(root.page)) {
          return PAGE_PRIMITIVE.test(source) ? [`${root.page}: ${file} draws a header band`] : [];
        }
        if (!PAGE_PRIMITIVE.test(source)) {
          return [`${root.page}: ${file} mounts no PaneShell or PageHeader`];
        }
        return propOf(root).test(source) ? [] : [`${root.page}: ${file} names no page kind`];
      }),
    );

    expect(drifted).toEqual([]);
  });

  it('registers a page root for every studio door that opens a page', () => {
    const doors = new Set(DOOR_PAGES.map((root) => root.page));
    const studioPages = Object.values(STUDIO_META).flatMap((meta) =>
      meta.page !== null && meta.close !== 'back' ? [meta.page] : [],
    );

    expect(studioPages.filter((page) => !doors.has(page))).toEqual([]);
  });

  it('lets no page set its own header padding or draw its own header slot', () => {
    const slotOwners = productionFiles().filter((key) => PANE_HEADER_SLOT.test(read(key)));
    const padded = HEADER_FILES.filter((file) => HEADER_PADDING.test(read(file)));
    const settings = read('features/settings/components/SettingsStudio/index.tsx');
    const settingsDetail = settings.slice(
      settings.indexOf('data-settings-detail'),
      settings.indexOf('>', settings.indexOf('data-settings-detail')),
    );

    expect(slotOwners).toEqual([]);
    expect(padded).toEqual([]);
    expect(settingsDetail).not.toMatch(HEADER_PADDING);
    expect(settings).not.toContain('UnderTrailContext');
    expect(PANE_RHYTHM.board.pad).not.toMatch(/\b(pt|py)-\d+\b/);
  });

  it('draws the top inset in one place, the page header primitive', () => {
    const header = readFileSync(join(UI, 'components/PaneShell/PageHeader.tsx'), 'utf8');
    const shell = readFileSync(join(UI, 'components/PaneShell/index.tsx'), 'utf8');

    expect(PANE_RHYTHM.headerInset).toBe('pt-2');
    expect(header).toContain('PANE_RHYTHM.headerInset');
    expect(header).toContain('<PaneTitleRow');
    expect(shell).toContain('<PageHeader');
    expect(shell).not.toMatch(/'pt-\d+'/);
  });
});

describe('every page steps its header aside while you read', () => {
  it('mounts every page root on a shell whose header reveals, keeping the back row', () => {
    const drifted = ALL_PAGES.flatMap((root) =>
      root.files.flatMap((file) => {
        if (/<PaneShell\b/.test(read(file))) {
          return [];
        }
        const shell = REVEAL_ROOT_OF[root.page];
        if (shell !== undefined && /<RevealRegion\b/.test(read(shell))) {
          return [];
        }
        const view = HEADERLESS_VIEW_OF[root.page];
        if (view !== undefined && !/<\w*PageHeader\b/.test(read(view))) {
          return [];
        }
        return [`${root.page}: ${file} draws a header that never steps aside`];
      }),
    );

    expect(drifted).toEqual([]);
  });

  it('draws the shell and every drawer on the one reveal region', () => {
    const shell = readFileSync(join(UI, 'components/PaneShell/RevealPane.tsx'), 'utf8');
    const drawer = readFileSync(join(UI, 'components/DrawerFrame.tsx'), 'utf8');
    const drawerRegion = readFileSync(join(UI, 'components/DrawerRegion.tsx'), 'utf8');
    const paneShell = readFileSync(join(UI, 'components/PaneShell/index.tsx'), 'utf8');

    expect(shell).toContain('<RevealRegion');
    expect(drawer).toContain('<DrawerRegion');
    expect(drawerRegion).toContain('<RevealRegion');
    expect(paneShell).not.toContain('headerMode');
  });

  it('keeps a side scroller of the body from moving the header', () => {
    const drifted = SIDE_SCROLLER_FILES.filter(
      (file) => !/<ScrollFade\b[^>]*isPageScroller=\{false\}/.test(read(file)),
    );

    expect(drifted).toEqual([]);
  });
});

describe('one measure per page kind', () => {
  it('puts Overview on the measure of the other session pages, the agent conversation apart', () => {
    const sessionMeasures = new Set(
      SESSION_PAGES.filter((root) => root.page !== 'agent').map((root) => PAGE_MEASURE[root.page]),
    );

    expect([...sessionMeasures]).toEqual(['column']);
    expect(PAGE_MEASURE.overview).toBe(PAGE_MEASURE.runs);
    expect(PAGE_MEASURE.agent).toBe('measure');
  });

  it('keeps the measure of every page kind', () => {
    const measures = Object.fromEntries(
      ALL_PAGES.map((root) => [root.page, PAGE_MEASURE[root.page]]),
    );

    expect(measures).toEqual(PAGE_KIND_MEASURE);
  });

  it('reads the 720 measure only on a reading page', () => {
    const reading = ALL_PAGES.filter((root) => PAGE_MEASURE[root.page] === 'measure').map(
      (root) => root.page,
    );

    expect(reading.filter((page) => !READING_PAGES.has(page))).toEqual([]);
  });

  it('lets no page root pick its own width beside its page kind', () => {
    const picked = ALL_PAGES.flatMap((root) =>
      root.files.filter((file) => /<(PaneShell|PageHeader)\b[^>]*?\swidth=/.test(read(file))),
    );

    expect(picked).toEqual([]);
  });
});

describe('empty states and skeletons on the page inset', () => {
  it('maps every studio page to the skeleton of its own body, never the board', () => {
    const bodies = Object.fromEntries(
      Object.entries(STUDIO_META).map(([kind, meta]) => [kind, meta.skeleton.shape]),
    );

    expect(bodies).toEqual(SKELETON_BODY_OF);
    expect(STUDIO_META.workflow.skeleton.shape).toBe('rows');
    expect(
      Object.values(STUDIO_META).filter(
        (meta) => meta.page !== null && BOARD_SKELETON_PAGES.has(meta.page),
      ),
    ).toEqual([]);
  });

  it('draws every page skeleton through the shared page skeleton', () => {
    const drifted = Object.entries(PAGE_SKELETON_FILES).filter(
      ([, file]) => !/<PageSkeleton\b/.test(read(file)),
    );
    const board = read('features/workspace/components/StageBoard/index.tsx');

    expect(drifted).toEqual([]);
    expect(board).toMatch(/pending && <BoardSkeleton/);
  });

  it('puts every page empty state on the page column, at its top left', () => {
    const drifted = PAGE_EMPTY_FILES.flatMap((file) => {
      const source = read(file);
      const at = source.indexOf('<EmptyState');
      const before = source.slice(0, at).split('\n').slice(-3).join('\n');
      const problems: Array<string> = [];
      if (at < 0) {
        problems.push(`${file} draws no EmptyState`);
      }
      if (!/<(PageColumn|PaneShell)\b|data-slot="board-empty"/.test(before)) {
        problems.push(`${file} draws its empty state off the page column`);
      }
      if (/justify-center|items-center/.test(before)) {
        problems.push(`${file} centres its empty state`);
      }
      return problems;
    });

    expect(drifted).toEqual([]);
  });
});
