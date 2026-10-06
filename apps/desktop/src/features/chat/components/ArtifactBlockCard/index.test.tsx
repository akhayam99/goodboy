// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessionArtifacts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    openDrawer: vi.fn(),
    navigate: vi.fn(),
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

import { ArtifactBlockCard } from './index';

const SESSION_ID = 'session-1' as SessionId;
const SCOUT = 'agent-scout' as AgentId;

const DRAWER_OF = (artifactId: string) => ({
  kind: 'artifact-document',
  sessionId: SESSION_ID,
  payload: { artifactId, revision: null },
});

const artifactOf = (overrides: Record<string, unknown>) => ({
  id: 'artifact-1',
  agentId: SCOUT,
  kind: 'report',
  title: 'Rounding drift in ledger-core postings',
  status: 'ready',
  sourceTurnId: 'run-1',
  ...overrides,
});

beforeEach(() => {
  state.sessionArtifacts = {};
  state.openDrawer = vi.fn();
  state.navigate = vi.fn();
  state.setScriptsLensScope = vi.fn();
});

afterEach(cleanup);

describe('ArtifactBlockCard', () => {
  it('opens the artifact the run that wrote the block produced in the drawer, the page kept', () => {
    state.sessionArtifacts = { [SESSION_ID]: [artifactOf({})] };
    render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'report',
          title: 'Release readout',
          complete: true,
          runId: 'run-1' as never,
        }}
        sessionId={SESSION_ID}
        agentId={SCOUT}
      />,
    );

    const chip = screen.getByTestId('artifact-block-chip');
    expect(chip.textContent).toContain('Report');
    expect(chip.textContent).toContain('Rounding drift in ledger-core postings');

    fireEvent.click(chip);
    expect(state.openDrawer).toHaveBeenCalledWith(DRAWER_OF('artifact-1'));
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('opens the revised artifact from the block the revision wrote', () => {
    state.sessionArtifacts = { [SESSION_ID]: [artifactOf({ sourceTurnId: 'run-1' })] };
    render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'report',
          title: 'Release readout',
          complete: true,
          runId: 'run-2' as never,
        }}
        sessionId={SESSION_ID}
        agentId={SCOUT}
      />,
    );

    fireEvent.click(screen.getByTestId('artifact-block-chip'));
    expect(state.openDrawer).toHaveBeenCalledWith(DRAWER_OF('artifact-1'));
  });

  it('leaves a block still arriving as a row with nothing to press', () => {
    const { container } = render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'wireframe',
          title: null,
          complete: false,
          runId: 'run-1' as never,
        }}
        sessionId={SESSION_ID}
        agentId={SCOUT}
      />,
    );

    expect(screen.getByTestId('artifact-block-row').textContent).toContain(
      'wireframe still arriving',
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('says so when the block names an artifact this session does not hold', () => {
    const { container } = render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'report',
          title: 'Release readout',
          complete: true,
          runId: 'run-9' as never,
        }}
        sessionId={SESSION_ID}
        agentId={SCOUT}
      />,
    );

    expect(screen.getByTestId('artifact-block-row').textContent).toContain(
      'Report not in this session',
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });
});
