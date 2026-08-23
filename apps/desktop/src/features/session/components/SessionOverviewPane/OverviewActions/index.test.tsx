import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';

vi.mock('../../CreateAgentPopover', () => ({
  CreateAgentPopover: () => <button type="button">New agent</button>,
}));

import { OverviewActions } from './index';

const SESSION_ID: SessionId = JSON.parse(JSON.stringify('session-1'));

afterEach(cleanup);

describe('OverviewActions', () => {
  it('keeps workflow and agent creation mounted in the Overview', () => {
    const onOpenWorkflowBuilder = vi.fn();
    render(
      <OverviewActions sessionId={SESSION_ID} onOpenWorkflowBuilder={onOpenWorkflowBuilder} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'New workflow' }));
    expect(screen.getByRole('button', { name: 'New agent' })).toBeDefined();
    expect(onOpenWorkflowBuilder).toHaveBeenCalledOnce();
  });

  it('yields to the section action rows when neither fact exists yet', () => {
    const { container } = render(
      <OverviewActions
        sessionId={SESSION_ID}
        onOpenWorkflowBuilder={vi.fn()}
        showNewWorkflow={false}
        showCreateAgent={false}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('hides only the covered action when its section row is present', () => {
    render(
      <OverviewActions
        sessionId={SESSION_ID}
        onOpenWorkflowBuilder={vi.fn()}
        showNewWorkflow={false}
        showCreateAgent
      />,
    );
    expect(screen.queryByRole('button', { name: 'New workflow' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New agent' })).toBeDefined();
  });
});
