// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { WorkflowRunSummary } from './index';

afterEach(cleanup);

describe('WorkflowRunSummary', () => {
  it('splits the structured recap into what landed and what is left', () => {
    render(
      <WorkflowRunSummary
        summary={JSON.stringify({ done: ['shipped the gate'], left: ['port the tests'] })}
      />,
    );

    const recap = screen.getByTestId('workflow-run-summary');
    expect(recap.textContent).toContain('Recap');
    expect(recap.textContent).toContain('Done');
    expect(recap.textContent).toContain('shipped the gate');
    expect(recap.textContent).toContain('Left');
    expect(recap.textContent).toContain('port the tests');
  });

  it('drops the Left group on a run with nothing open', () => {
    render(
      <WorkflowRunSummary summary={JSON.stringify({ done: ['shipped the gate'], left: [] })} />,
    );

    const recap = screen.getByTestId('workflow-run-summary');
    expect(recap.textContent).toContain('shipped the gate');
    expect(recap.textContent).not.toContain('Left');
  });

  it('reads a recap a run recorded as markdown before the structured form', () => {
    render(
      <WorkflowRunSummary summary={'**Done**\n\n- shipped the gate\n\n**Left**\n\n- tests'} />,
    );

    const recap = screen.getByTestId('workflow-run-summary');
    expect(recap.textContent).toContain('shipped the gate');
    expect(recap.textContent).toContain('tests');
  });

  it('takes no room on a run the orchestrator never recapped', () => {
    render(<WorkflowRunSummary summary={undefined} />);
    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();

    cleanup();
    render(<WorkflowRunSummary summary="   " />);
    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();

    cleanup();
    render(<WorkflowRunSummary summary={JSON.stringify({ done: [], left: [] })} />);
    expect(screen.queryByTestId('workflow-run-summary')).toBeNull();
  });
});
