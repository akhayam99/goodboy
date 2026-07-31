// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session, WorkflowRunId } from '@goodboy/types';

type AgentsSectionMockProps = {
  readonly workflowRunId: WorkflowRunId;
  readonly workflowVariant: string;
  readonly showWorkflowAttach: boolean;
};

vi.mock('@goodboy/ui', () => ({
  ScrollFade: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection', () => ({
  AgentsSection: ({
    workflowRunId,
    workflowVariant,
    showWorkflowAttach,
  }: AgentsSectionMockProps) => (
    <div
      data-testid="agents-section"
      data-run-id={workflowRunId}
      data-variant={workflowVariant}
      data-attach={String(showWorkflowAttach)}
    />
  ),
}));

import { WorkflowRunDetail } from './WorkflowRunDetail';

const RUN_ID = 'run-1' as WorkflowRunId;
const session = { id: 'session-1' } as unknown as Session;

afterEach(cleanup);

describe('WorkflowRunDetail', () => {
  it('shows the steps of the focused run without a second detail surface', () => {
    render(<WorkflowRunDetail session={session} workflowRunId={RUN_ID} />);

    const section = screen.getByTestId('agents-section');
    expect(section.getAttribute('data-run-id')).toBe(RUN_ID);
    expect(section.getAttribute('data-variant')).toBe('detail');
    expect(section.getAttribute('data-attach')).toBe('false');
  });
});
