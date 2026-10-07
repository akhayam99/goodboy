// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { WorkflowStartButton } from './WorkflowStartButton';

afterEach(cleanup);

const SESSION_ID: SessionId = JSON.parse(JSON.stringify('session-1'));

describe('the Runs first-time state', () => {
  it('says what a run is and offers one primary, Start a run', () => {
    const opened = vi.fn();
    window.addEventListener('goodboy:open-workflow-builder', opened);
    render(<WorkflowStartButton sessionId={SESSION_ID} />);

    expect(screen.getByRole('heading', { level: 2, name: 'No runs yet' })).toBeDefined();
    expect(screen.getByText('A run is a workflow working on this session.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start a run' }));
    window.removeEventListener('goodboy:open-workflow-builder', opened);

    expect(opened).toHaveBeenCalledOnce();
  });

  it('collapses to one unheaded line inside a section', () => {
    render(<WorkflowStartButton sessionId={SESSION_ID} layout="section" />);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('No runs yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start a run' })).toBeDefined();
  });
});
