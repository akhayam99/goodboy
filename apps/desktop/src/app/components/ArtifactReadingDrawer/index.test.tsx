// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('../../../features/reports/components/ReportStudio', () => ({
  ReportStudio: ({ artifact }: { artifact: { title: string } }) => (
    <p>Report body {artifact.title}</p>
  ),
}));
vi.mock('../../../features/wireframes/components/WireframeViewer', () => ({
  WireframeViewer: ({ artifact }: { artifact: { title: string } }) => (
    <p>Wireframe stage {artifact.title}</p>
  ),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  AgentId,
  ArtifactId,
  IsoDateTime,
  ReportArtifact,
  SessionId,
  WireframeArtifact,
} from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import { DrawerHost } from '../DrawerHost';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION_ID = 'session-harborline' as SessionId;
const REPORT = 'artifact-report' as ArtifactId;
const WIREFRAME = 'artifact-wireframe' as ArtifactId;

const AT = '2026-09-25T10:00:00.000Z' as IsoDateTime;

const base = (id: ArtifactId, title: string) => ({
  id,
  sessionId: SESSION_ID,
  agentId: 'agent-scout' as AgentId,
  workflowRunId: null,
  schemaVersion: 1,
  title,
  sourceText: '',
  status: 'active' as const,
  revision: 2,
  sourceTurnId: null,
  createdAt: AT,
  updatedAt: AT,
  openedAt: null,
});

const REPORT_ARTIFACT: ReportArtifact = {
  ...base(REPORT, 'Rounding drift in ledger-core'),
  kind: 'report',
  sourceFormat: 'markdown',
  metadata: { reportType: 'session-summary' },
};

const WIREFRAME_ARTIFACT: WireframeArtifact = {
  ...base(WIREFRAME, 'Checkout retry screen'),
  kind: 'wireframe',
  sourceFormat: 'json',
  metadata: { fidelity: 'low', designProfile: {} },
};

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentSessionId: SESSION_ID,
    sessionArtifacts: {
      [SESSION_ID]: [REPORT_ARTIFACT, WIREFRAME_ARTIFACT],
    },
  });
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const open = (artifactId: ArtifactId): void =>
  useAppStore.getState().openDrawer({
    kind: 'artifact-document',
    sessionId: SESSION_ID,
    payload: { artifactId, revision: null },
  });

describe('a report or wireframe opened from its work', () => {
  it('reads a report in the drawer, half the window', () => {
    open(REPORT);
    render(<DrawerHost />);

    const drawer = screen.getByTestId('artifact-reading-drawer');
    expect(drawer.getAttribute('data-artifact-kind')).toBe('report');
    expect(screen.getByText('Report body Rounding drift in ledger-core')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Rounding drift in ledger-core' })).toBeDefined();
  });

  it('shows a wireframe stage in the drawer and expands it over the page', () => {
    open(WIREFRAME);
    render(<DrawerHost />);

    expect(screen.getByText('Wireframe stage Checkout retry screen')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Expand' }));
    expect(useAppStore.getState().documentDrawerExpanded[SESSION_ID]).toBe(true);
  });

  it('goes to the Artifacts library only on its explicit command', () => {
    const navigate = vi.fn<StoreState['navigate']>();
    restore = { navigate: useAppStore.getState().navigate };
    useAppStore.setState({ navigate });
    open(REPORT);
    render(<DrawerHost />);

    fireEvent.click(screen.getByRole('button', { name: 'Open in Artifacts' }));

    expect(navigate).toHaveBeenCalledWith({
      to: {
        at: 'session',
        sessionId: SESSION_ID,
        view: {
          lens: 'plans',
          agentId: null,
          studio: null,
          target: { kind: 'artifact', artifactId: REPORT },
        },
      },
    });
  });
});
