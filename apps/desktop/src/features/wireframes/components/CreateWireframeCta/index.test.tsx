// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    openArtifactCreation: vi.fn(),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { CreateWireframeCta } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-harborline'));
const RUN_ID = JSON.parse(JSON.stringify('run-ledger-1'));

afterEach(cleanup);

describe('CreateWireframeCta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens the creation pane instead of spawning', () => {
    render(<CreateWireframeCta sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByTestId('create-wireframe-cta'));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
      workflowRunId: null,
    });
  });

  it('carries the run it sits under into the pane', () => {
    render(<CreateWireframeCta sessionId={SESSION_ID} workflowRunId={RUN_ID} />);
    fireEvent.click(screen.getByTestId('create-wireframe-cta'));
    expect(state.openArtifactCreation).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      kind: 'wireframe',
      workflowRunId: RUN_ID,
    });
  });

  it('stays enabled while nothing has run', () => {
    render(<CreateWireframeCta sessionId={SESSION_ID} />);
    const trigger = screen.getByTestId('create-wireframe-cta');
    expect(trigger.hasAttribute('disabled')).toBe(false);
    expect(trigger.getAttribute('title')).toBe(
      'Draw a screen or flow from a brief and what this session did',
    );
  });
});
