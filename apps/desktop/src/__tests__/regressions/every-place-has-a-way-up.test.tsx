// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { installFakeResizeObserver } from '../../test/fakeResizeObserver';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import { SessionWorkspace } from '../../features/session/components/SessionWorkspace';
import { captureLocation } from '../../store/slices/navigation/captureLocation';
import { agentPlace, branchPlace, sessionPlace } from '../../store/slices/navigation/place';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { upTrailOf } from '../../store/slices/navigation/upTrailOf';
import { LENS_KINDS } from '../../store/slices/session-view/types';
import {
  AGENT_BACKFILL_ID,
  CHAT_ARTIFACTS,
  DYNAMIC_RUN_ID,
  FLOW_MOUNTS,
  FLOW_SESSION,
  FLOW_SESSION_ID,
  NOW,
  SESSIONS,
} from '../../app/components/MockScene/scenes/flow-audit/fixtures';
import { seedShellChrome } from '../../app/components/MockScene/scenes/shellChrome';
import { seedWorkflowRun } from '../../app/components/MockScene/scenes/flow-audit/seeds';
import type { StoryStore } from '../../store/storyHarness';

const SRC = join(__dirname, '..', '..');
const UI_SRC = join(SRC, '..', '..', '..', 'packages', 'ui', 'src');
const TRAIL = 'nav[aria-label="Breadcrumb"]';
const BACK_ICON = /\b(ArrowLeft|ChevronLeft)\b/;
const FIRST_MOUNT_PATH = FLOW_MOUNTS[0]?.worktreePath ?? null;
const FIRST_ARTIFACT_ID = CHAT_ARTIFACTS[0]?.id ?? null;

const DRAWER_FRAME = 'packages/ui/src/components/DrawerFrame.tsx';

const drawerFrameParts = (): ReadonlyArray<string> =>
  [
    ...readFileSync(join(UI_SRC, 'components', 'DrawerFrame.tsx'), 'utf8').matchAll(
      /from '\.\/(Drawer\w+)'/g,
    ),
  ].map((match) => `packages/ui/src/components/${match[1] ?? ''}.tsx`);

const WAYS_UP = new Set([
  DRAWER_FRAME,
  ...drawerFrameParts(),
  'app/components/AppTopBar/NavCluster/HistoryArrow.tsx',
]);

const NOT_A_WAY_UP: Readonly<Record<string, string>> = {
  'app/components/SessionRail/RailWorktreeLevel.tsx':
    'the session rail level row back to the session, a list level and not a page',
  'features/chat/components/HandoffBlock/HandoffPanel.tsx': 'a pager between handoffs',
  'features/context/components/QuestionsTab/QuestionCard/QuestionPager.tsx':
    'a pager between questions',
  'features/integrations/slack/SlackConnectGuide.tsx': 'the previous step of a setup guide',
  'features/settings/components/SettingsStudio/SettingsColumnNav.tsx':
    'Back to app is the studio Close, not an up',
  'features/session/components/SessionWorkspace/parts/AgentOverlay.tsx':
    'the empty state of a gone agent; the trail above it is the way up',
  'features/session/ask/components/AskDrawer/AskPlanView.tsx':
    'a view inside the Ask drawer; moves to the DrawerFrame back when touched (plan P5)',
  'features/session/components/ContextDrawer/VersionsView.tsx':
    'a view inside the context drawer; moves to the DrawerFrame back when touched (plan P5)',
};

const CONTEXT_DRAWER = 'opens the context drawer on the Overview; a drawer is not an address';

const SIDE_PANE = 'openLens opens it as a pane beside the session, never as a page';

const PAGELESS: Readonly<Record<string, string>> = {
  'the context page': CONTEXT_DRAWER,
  'the goal page': CONTEXT_DRAWER,
  'the decisions page': CONTEXT_DRAWER,
  'the last_output_summary page': CONTEXT_DRAWER,
  'the scripts page': SIDE_PANE,
  'the explore page': SIDE_PANE,
  'an explore folder': SIDE_PANE,
};

const PLACES: ReadonlyArray<readonly [string, PlaceRequest]> = [
  ...[...LENS_KINDS].map(
    (lens) => [`the ${lens} page`, sessionPlace({ sessionId: FLOW_SESSION_ID, lens })] as const,
  ),
  [
    'a run',
    sessionPlace({
      sessionId: FLOW_SESSION_ID,
      lens: 'workflows',
      target: { kind: 'run', runId: DYNAMIC_RUN_ID },
    }),
  ],
  [
    'an artifact',
    sessionPlace({
      sessionId: FLOW_SESSION_ID,
      lens: 'plans',
      target:
        FIRST_ARTIFACT_ID === null ? null : { kind: 'artifact', artifactId: FIRST_ARTIFACT_ID },
    }),
  ],
  [
    'a GitHub issue',
    sessionPlace({
      sessionId: FLOW_SESSION_ID,
      lens: 'github_issue',
      target: { kind: 'github-issue', issueNumber: 12 },
    }),
  ],
  [
    'an external task',
    sessionPlace({
      sessionId: FLOW_SESSION_ID,
      lens: 'linear',
      target: {
        kind: 'external-task',
        task: { provider: 'linear', externalId: 'CAS-231', projectId: null },
      },
    }),
  ],
  [
    'a diff',
    sessionPlace({
      sessionId: FLOW_SESSION_ID,
      lens: 'files',
      target: { kind: 'diff', mountPath: FIRST_MOUNT_PATH, focus: null },
    }),
  ],
  [
    'a Branch section',
    branchPlace({ sessionId: FLOW_SESSION_ID, mountPath: FIRST_MOUNT_PATH, tab: 'commits' }),
  ],
  [
    'a thread',
    branchPlace({
      sessionId: FLOW_SESSION_ID,
      mountPath: FIRST_MOUNT_PATH,
      tab: 'comments',
      threadId: 'thread-1',
    }),
  ],
  [
    'an explore folder',
    sessionPlace({
      sessionId: FLOW_SESSION_ID,
      lens: 'explore',
      target: { kind: 'explore', mountPath: FIRST_MOUNT_PATH ?? '' },
    }),
  ],
  ['an agent', agentPlace({ sessionId: FLOW_SESSION_ID, agentId: AGENT_BACKFILL_ID })],
];

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  seedWorkflowRun();
  seedShellChrome({
    session: FLOW_SESSION,
    siblings: SESSIONS.filter((candidate) => candidate.id !== FLOW_SESSION.id),
    branches: {},
    telemetryAt: NOW,
    lens: null,
  });
  useAppStore.setState({ currentWorkspaceId: FLOW_SESSION.workspaceId, selectedAgentId: {} });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const isShown = (node: Element): boolean =>
  node.closest('[inert]') === null && node.closest('[hidden]') === null;

const shownTrails = (): ReadonlyArray<ReadonlyArray<string>> =>
  [...document.querySelectorAll(TRAIL)]
    .filter(isShown)
    .map((trail) =>
      [...trail.querySelectorAll('[data-trail-piece]')].map((piece) => piece.textContent ?? ''),
    );

const sourcesOf = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'MockScene' || name === '__tests__' ? [] : sourcesOf(path);
    }
    return name.endsWith('.tsx') && !name.includes('.test.') ? [path] : [];
  });

type SourceParams = {
  readonly source: string;
};

const importsBackIcon = ({ source }: SourceParams): boolean =>
  source
    .split(';')
    .filter((statement) => statement.includes("from 'lucide-react'"))
    .some((statement) => BACK_ICON.test(statement));

const keyOf = (path: string): string =>
  path.startsWith(UI_SRC) ? `packages/ui/src/${relative(UI_SRC, path)}` : relative(SRC, path);

describe('every place has a way up', () => {
  it.each(PLACES)('draws the up trail on %s', async (name, to) => {
    act(() => useAppStore.getInitialState().navigate({ to }));
    const state = useAppStore.getState();
    const expected = upTrailOf({
      state,
      place: captureLocation({ state }).place,
      onUp: () => undefined,
    }).map((segment) => segment.label);

    render(
      <ToastProvider>
        <SessionWorkspace session={FLOW_SESSION} isActive />
      </ToastProvider>,
    );

    if (PAGELESS[name] !== undefined) {
      expect(shownTrails()).toEqual([]);
      return;
    }
    expect(expected.length).toBeGreaterThan(1);
    await waitFor(() => expect(shownTrails()).toEqual([expected]), { timeout: 4_000 });
  });

  it('names only walked places as pageless', () => {
    const names = new Set(PLACES.map(([name]) => name));

    expect(Object.keys(PAGELESS).filter((name) => !names.has(name))).toEqual([]);
  });

  it('draws a back arrow or chevron only in Trail, DrawerFrame and the history arrows', () => {
    const offenders = [
      ...sourcesOf(join(SRC, 'app')),
      ...sourcesOf(join(SRC, 'features')),
      ...sourcesOf(join(SRC, 'shared')),
      ...sourcesOf(UI_SRC),
    ]
      .filter((path) => importsBackIcon({ source: readFileSync(path, 'utf8') }))
      .map(keyOf)
      .filter((key) => !WAYS_UP.has(key) && NOT_A_WAY_UP[key] === undefined);

    expect(offenders).toEqual([]);
  });

  it('keeps no allowlist entry whose file lost its back glyph', () => {
    const stale = Object.keys(NOT_A_WAY_UP).filter(
      (key) =>
        !existsSync(join(SRC, key)) ||
        !importsBackIcon({ source: readFileSync(join(SRC, key), 'utf8') }),
    );

    expect(stale).toEqual([]);
  });
});
