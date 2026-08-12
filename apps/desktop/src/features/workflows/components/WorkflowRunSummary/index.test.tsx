// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WorkflowRunSummary } from './index';

afterEach(cleanup);

describe('WorkflowRunSummary', () => {
  it('reads the recap the orchestrator kept on the run', () => {
    render(
      <WorkflowRunSummary summary={'**Done**\n\n- shipped the gate\n\n**Left**\n\n- tests'} />,
    );

    const recap = screen.getByTestId('workflow-run-summary');
    expect(recap.textContent).toContain('Recap');
    expect(recap.textContent).toContain('shipped the gate');
    expect(recap.textContent).toContain('tests');
  });

  it('takes no room on a run the orchestrator never recapped', () => {
    render(<WorkflowRunSummary summary={undefined} />);
    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();

    cleanup();
    render(<WorkflowRunSummary summary="   " />);
    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();
  });
});
