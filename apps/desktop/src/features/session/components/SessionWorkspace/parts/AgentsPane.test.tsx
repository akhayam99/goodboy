// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

vi.mock('@goodboy/ui', () => ({
  ScrollFade: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  ResizeHandle: ({ ariaLabel }: { readonly ariaLabel: string }) => (
    <div role="separator" aria-label={ariaLabel} />
  ),
  CountToggle: ({
    label,
    count,
    isShown,
    onChange,
  }: {
    readonly label: string;
    readonly count: number;
    readonly isShown: boolean;
    readonly onChange: (isShown: boolean) => void;
  }) =>
    count === 0 ? null : (
      <button type="button" aria-pressed={isShown} onClick={() => onChange(!isShown)}>
        {label} ({count})
      </button>
    ),
  cn: (...values: ReadonlyArray<unknown>) => values.filter(Boolean).join(' '),
}));

vi.mock('../../StandaloneAgentsLane', () => ({
  StandaloneAgentsLane: ({
    variant,
    inspectedAgentId,
    showCompleted,
    onCompletedCountChange,
    filedToggle,
  }: {
    readonly variant?: string;
    readonly inspectedAgentId?: string | null;
    readonly showCompleted?: boolean;
    readonly onCompletedCountChange?: (completedCount: number) => void;
    readonly filedToggle?: React.ReactNode;
  }) => (
    <>
      <div
        data-testid="agents-lane"
        data-variant={variant}
        data-inspected={String(inspectedAgentId)}
        data-show-completed={String(showCompleted)}
      >
        {filedToggle}
      </div>
      <button type="button" onClick={() => onCompletedCountChange?.(2)}>
        Report completed agents
      </button>
    </>
  ),
}));

vi.mock('../../CreateAgentPopover', () => ({
  CreateAgentPopover: ({ variant }: { readonly variant?: string }) => (
    <button type="button" data-testid="header-spawn" data-variant={variant}>
      Create agent
    </button>
  ),
}));

vi.mock('../../AgentInspector', () => ({ AgentInspector: () => null }));

import { AgentsPane } from './AgentsPane';

const SESSION = { id: 'sess-1', workspaceId: 'ws-1' } as unknown as Session;

afterEach(cleanup);

describe('AgentsPane', () => {
  it('hosts a single compact create-agent trigger in the pane header', () => {
    render(
      <AgentsPane
        session={SESSION}
        meta={undefined}
        inspectedAgentId={null}
        onInspectAgent={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
      />,
    );

    const heading = screen.getByRole('heading', { name: 'Agents' });
    const header = heading.parentElement?.parentElement?.parentElement;
    const trigger = screen.getByTestId('header-spawn');
    expect(header?.contains(trigger)).toBe(true);
    expect(trigger.getAttribute('data-variant')).toBe('compact');
    expect(screen.getAllByTestId('header-spawn')).toHaveLength(1);
  });

  it('renders the shared agents lane and forwards the inspected agent', () => {
    render(
      <AgentsPane
        session={SESSION}
        meta={undefined}
        inspectedAgentId={'agent-7' as never}
        onInspectAgent={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={vi.fn()}
      />,
    );

    const lane = screen.getByTestId('agents-lane');
    expect(lane.getAttribute('data-variant')).toBe('lens');
    expect(lane.getAttribute('data-inspected')).toBe('agent-7');
  });

  it('places the completed toggle after the list, not in the header, and forwards its state', () => {
    const onShowCompletedChange = vi.fn();
    render(
      <AgentsPane
        session={SESSION}
        meta={undefined}
        inspectedAgentId={null}
        onInspectAgent={vi.fn()}
        showCompleted={false}
        onShowCompletedChange={onShowCompletedChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Report completed agents' }));
    const toggle = screen.getByRole('button', { name: 'Completed (2)' });
    const create = screen.getByTestId('header-spawn');
    const lane = screen.getByTestId('agents-lane');
    expect(create.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(lane.contains(toggle)).toBe(true);
    fireEvent.click(toggle);
    expect(onShowCompletedChange).toHaveBeenCalledWith(true);
    expect(screen.getByTestId('agents-lane').getAttribute('data-show-completed')).toBe('false');
  });
});
