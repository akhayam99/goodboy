// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  AgentId,
  ArtifactId,
  ArtifactStatus,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  PlanArtifact,
  ReportArtifact,
  Session,
  SessionId,
  WireframeArtifact,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('./SessionDestructiveActions', () => ({
  SessionDestructiveActions: () => (
    <>
      <button aria-label="Archive session" />
      <button aria-label="Delete session" />
    </>
  ),
}));
vi.mock('./SessionRefreshAction', () => ({
  SessionRefreshAction: () => <button aria-label="Refresh" />,
}));
vi.mock('./ArchivedRestore', () => ({ ArchivedRestore: () => <button>Restore</button> }));
vi.mock('./ChatOriginRow', () => ({ ChatOriginRow: () => null }));
vi.mock('./ContextChip', () => ({ ContextChip: () => <span>Context</span> }));
vi.mock('./GoalTeaser', () => ({
  GoalTeaser: () => <button type="button">Goal: Keep the ledger balanced</button>,
}));
vi.mock('./SessionCostChip', () => ({ SessionCostChip: () => <span>$3.47</span> }));
vi.mock('./LinkedWorkChips', () => ({ LinkedWorkChips: () => <span>HAR-212</span> }));
vi.mock('./LinkIssueAction', () => ({ LinkIssueAction: () => <button>Link work</button> }));
vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return { ...actual, Tooltip: ({ children }: { readonly children: ReactNode }) => children };
});

let useAppStore: StoryStore;
let HeaderBand: typeof import('./HeaderBand').HeaderBand;

beforeAll(async () => {
  useAppStore = await importStore();
  ({ HeaderBand } = await import('./HeaderBand'));
}, STORE_IMPORT_TIMEOUT_MS);

const SESSION_ID = 'session-1' as SessionId;
const NOW = '2026-09-28T09:00:00.000Z' as IsoDateTime;

const session: Session = aSession({
  id: SESSION_ID,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Refactor auth',
});

type BaseParams = {
  readonly id: string;
  readonly status?: ArtifactStatus;
};

const baseOf = ({ id, status = 'active' }: BaseParams) => ({
  id: id as ArtifactId,
  sessionId: SESSION_ID,
  agentId: 'agent-1' as AgentId,
  workflowRunId: null,
  schemaVersion: 1,
  title: id,
  sourceText: '',
  status,
  revision: 1,
  sourceTurnId: null,
  createdAt: NOW,
  updatedAt: NOW,
});

const report = (params: BaseParams): ReportArtifact => ({
  ...baseOf(params),
  kind: 'report',
  sourceFormat: 'markdown',
  metadata: { reportType: 'summary' },
});

const wireframe = (params: BaseParams): WireframeArtifact => ({
  ...baseOf(params),
  kind: 'wireframe',
  sourceFormat: 'json',
  metadata: { fidelity: 'low', designProfile: {} },
});

const plan = (params: BaseParams): PlanArtifact => ({
  ...baseOf(params),
  kind: 'plan',
  sourceFormat: 'markdown',
  metadata: {},
});

const openQuestion: OpenQuestion = {
  id: 'q1' as OpenQuestionId,
  sessionId: SESSION_ID,
  text: 'Which ledger?',
  suggestedAnswers: [],
  isBlocking: false,
  userAnswer: null,
  status: 'open',
  createdAt: NOW,
};

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ sessions: [session] });
});

afterEach(cleanup);

describe('HeaderBand', () => {
  it('marks a title Goodboy wrote at the start until the user renames it', () => {
    useAppStore.setState({ goodboyNamedSessionId: SESSION_ID });
    const { unmount } = render(<HeaderBand session={session} onSelectLens={vi.fn()} />);
    screen.getByText('Named by Goodboy');
    unmount();

    render(<HeaderBand session={{ ...session, titleUserEdited: true }} onSelectLens={vi.fn()} />);
    expect(screen.queryByText('Named by Goodboy')).toBeNull();
  });

  it('offers Link work on a live session and drops it once archived', () => {
    const { unmount } = render(<HeaderBand session={session} onSelectLens={vi.fn()} />);
    screen.getByRole('button', { name: 'Link work' });
    unmount();

    render(<HeaderBand session={{ ...session, archivedAt: NOW }} onSelectLens={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Link work' })).toBeNull();
  });

  it('says what waits on the user only in the next step, never as header chips', () => {
    useAppStore.setState({ sessionOpenQuestions: { [SESSION_ID]: [openQuestion] } });
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /Questions/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Review/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Artifacts/ })).toBeNull();
  });

  it('counts reports, wireframes and plans in Artifacts and opens their page', () => {
    useAppStore.setState({
      sessionArtifacts: {
        [SESSION_ID]: [
          report({ id: 'a1' }),
          wireframe({ id: 'a2' }),
          plan({ id: 'a3' }),
          report({ id: 'a4', status: 'discarded' }),
        ],
      },
    });
    const onSelectLens = vi.fn();
    render(<HeaderBand session={session} onSelectLens={onSelectLens} />);

    const chip = screen.getByRole('button', { name: /Artifacts/ });
    expect(chip.textContent).toContain('3');
    fireEvent.click(chip);
    expect(onSelectLens).toHaveBeenCalledWith('plans');
  });

  it('keeps every session fact on one row', () => {
    useAppStore.setState({
      sessionArtifacts: { [SESSION_ID]: [plan({ id: 'a1' })] },
    });
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    const facts = within(screen.getByLabelText('Session facts'));
    facts.getByText('Context');
    facts.getByRole('button', { name: /Artifacts/ });
    facts.getByText('HAR-212');
    facts.getByRole('button', { name: 'Link work' });
    facts.getByText('$3.47');
  });

  it('keeps only refresh, archive and delete in the title action zone, in that order', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    const refresh = screen.getByRole('button', { name: 'Refresh' });
    const archive = screen.getByRole('button', { name: 'Archive session' });
    screen.getByRole('button', { name: 'Delete session' });
    expect(
      refresh.compareDocumentPosition(archive) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mount a project' })).toBeNull();
  });

  it('drops refresh from an archived session', () => {
    render(<HeaderBand session={{ ...session, archivedAt: NOW }} onSelectLens={vi.fn()} />);

    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  });

  it('reads the goal line before the facts and leaves the projects to the body', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    const goal = screen.getByRole('button', { name: /^Goal:/ });
    const facts = screen.getByLabelText('Session facts');
    expect(goal.compareDocumentPosition(facts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Projects' })).toBeNull();
  });

  it('separates the title zone with rhythm instead of a rule', () => {
    render(<HeaderBand session={session} onSelectLens={vi.fn()} />);

    expect(screen.queryAllByRole('separator')).toHaveLength(0);
  });

  it('renders a backticked title as inline code without the backticks', () => {
    render(
      <HeaderBand session={{ ...session, goal: 'run `/explore` first' }} onSelectLens={vi.fn()} />,
    );

    const title = screen.getByRole('button', { name: /run/ });
    expect(title.querySelector('code')?.textContent).toBe('/explore');
    expect(title.textContent).not.toContain('`');
  });

  it('falls back to one untitled label when the session carries no title', () => {
    render(<HeaderBand session={{ ...session, goal: '   ' }} onSelectLens={vi.fn()} />);

    screen.getByRole('button', { name: 'Untitled session' });
  });
});
