// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

vi.mock('@goodboy/ui', () => ({
  ScrollFade: ({ children }: { readonly children: React.ReactNode }) => <div>{children}</div>,
  ResizeHandle: ({ ariaLabel }: { readonly ariaLabel: string }) => (
    <div role="separator" aria-label={ariaLabel} />
  ),
  cn: (...values: ReadonlyArray<unknown>) => values.filter(Boolean).join(' '),
}));

vi.mock('../../StandaloneAgentsLane', () => ({
  StandaloneAgentsLane: ({
    variant,
    inspectedAgentId,
  }: {
    readonly variant?: string;
    readonly inspectedAgentId?: string | null;
  }) => (
    <div
      data-testid="agents-lane"
      data-variant={variant}
      data-inspected={String(inspectedAgentId)}
    />
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
      />,
    );

    const lane = screen.getByTestId('agents-lane');
    expect(lane.getAttribute('data-variant')).toBe('lens');
    expect(lane.getAttribute('data-inspected')).toBe('agent-7');
  });
});
