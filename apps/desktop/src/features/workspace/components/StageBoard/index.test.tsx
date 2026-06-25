// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session, WorkspaceId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    boardReady: true,
    archivedSessions: {} as Record<string, ReadonlyArray<Session>>,
    loadArchivedSessions: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: (selector: (s: typeof state) => unknown) => selector(state),
  useStageGroupedSessions: () => [],
}));

vi.mock('./useBoardNavigation', () => ({
  useBoardNavigation: () => ({ restore: vi.fn() }),
}));

vi.mock('./StageColumn', () => ({
  StageColumn: ({ spec }: { spec: { kind: string; stage?: string } }) => (
    <div data-testid="stage-column">{spec.kind === 'stage' ? spec.stage : 'archived'}</div>
  ),
}));

vi.mock('../WorkspaceHeader', () => ({ WorkspaceHeader: () => <div /> }));
vi.mock('../../../session/components/ArchiveSessionDialog', () => ({
  ArchiveSessionDialog: () => null,
}));
vi.mock('../../../session/components/DeleteSessionDialog', () => ({
  DeleteSessionDialog: () => null,
}));
vi.mock('../../../../shared/components/DogMascot', () => ({ DogMascot: () => <div /> }));

import { StageBoard } from './index';

const session = { id: 's-1' } as Session;
const wsId = 'ws-a' as WorkspaceId;
const onCreate = vi.fn();

beforeEach(() => {
  state.boardReady = true;
  state.archivedSessions = {};
  state.loadArchivedSessions = vi.fn();
});
afterEach(cleanup);

describe('StageBoard loading gate', () => {
  it('shows the skeleton board while boardReady is false, hiding columns and empty state', () => {
    state.boardReady = false;
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    expect(screen.getByLabelText('Loading board')).toBeDefined();
    expect(screen.queryByTestId('stage-column')).toBeNull();
    expect(screen.queryByText('Start your first session')).toBeNull();
  });

  it('renders the empty state once ready with no sessions', () => {
    render(<StageBoard workspaceId={wsId} sessions={[]} onCreateSession={onCreate} />);
    expect(screen.queryByLabelText('Loading board')).toBeNull();
    expect(screen.getByText('Start your first session')).toBeDefined();
  });

  it('renders stage columns once ready with sessions', () => {
    render(<StageBoard workspaceId={wsId} sessions={[session]} onCreateSession={onCreate} />);
    expect(screen.queryByLabelText('Loading board')).toBeNull();
    expect(screen.getAllByTestId('stage-column').length).toBeGreaterThan(0);
  });
});
