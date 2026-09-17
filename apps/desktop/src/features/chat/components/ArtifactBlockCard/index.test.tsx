// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    sessionArtifacts: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    setFocusedArtifactId: vi.fn(),
    setFocusedPlanId: vi.fn(),
    setActiveLens: vi.fn(),
    setScriptsLensScope: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [],
  useAppStore: Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

import { ArtifactBlockCard } from './index';

const SESSION_ID = 'session-1' as SessionId;
const SCOUT = 'agent-scout' as AgentId;

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
  state.setFocusedArtifactId = vi.fn();
  state.setFocusedPlanId = vi.fn();
  state.setActiveLens = vi.fn();
  state.setScriptsLensScope = vi.fn();
});

afterEach(cleanup);

describe('ArtifactBlockCard', () => {
  it('opens the artifact the run that wrote the block produced', () => {
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
    expect(state.setFocusedArtifactId).toHaveBeenCalledWith(SESSION_ID, 'artifact-1');
    expect(state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'plans');
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
    expect(state.setFocusedArtifactId).toHaveBeenCalledWith(SESSION_ID, 'artifact-1');
  });

  it('sends a plan block to the plan it wrote', () => {
    state.sessionArtifacts = {
      [SESSION_ID]: [artifactOf({ id: 'plan-1', kind: 'plan', title: 'Rollout' })],
    };
    render(
      <ArtifactBlockCard
        item={{
          kind: 'artifact_block',
          key: 'text-0-artifact-0',
          artifactKind: 'plan',
          title: 'Rollout',
          complete: true,
          runId: 'run-1' as never,
        }}
        sessionId={SESSION_ID}
        agentId={SCOUT}
      />,
    );

    fireEvent.click(screen.getByTestId('artifact-block-chip'));
    expect(state.setFocusedPlanId).toHaveBeenCalledWith(SESSION_ID, 'plan-1');
    expect(state.setFocusedArtifactId).not.toHaveBeenCalled();
    expect(state.setActiveLens).toHaveBeenCalledWith(SESSION_ID, 'plans');
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
