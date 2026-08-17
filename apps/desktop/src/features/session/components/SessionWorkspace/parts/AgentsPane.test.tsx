// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
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
    showCompleted,
    onCompletedCountChange,
    filedToggle,
  }: {
    readonly variant?: string;
    readonly showCompleted?: boolean;
    readonly onCompletedCountChange?: (completedCount: number) => void;
    readonly filedToggle?: React.ReactNode;
  }) => (
    <>
      <div
        data-testid="agents-lane"
        data-variant={variant}
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

import { AgentsPane } from './AgentsPane';

const SESSION = { id: 'sess-1', workspaceId: 'ws-1' } as unknown as Session;

afterEach(cleanup);

describe('AgentsPane', () => {
  it('hosts a single compact create-agent trigger in the pane header', () => {
    render(<AgentsPane session={SESSION} meta={undefined} />);

    const heading = screen.getByRole('heading', { name: 'Agents' });
    const header = heading.parentElement?.parentElement?.parentElement;
    const trigger = screen.getByTestId('header-spawn');
    expect(header?.contains(trigger)).toBe(true);
    expect(trigger.getAttribute('data-variant')).toBe('compact');
    expect(screen.getAllByTestId('header-spawn')).toHaveLength(1);
  });

  it('renders the shared agents lane', () => {
    render(<AgentsPane session={SESSION} meta={undefined} />);

    const lane = screen.getByTestId('agents-lane');
    expect(lane.getAttribute('data-variant')).toBe('lens');
  });

  it('shows completed agents in the lane without interaction', () => {
    render(<AgentsPane session={SESSION} meta={undefined} />);

    const lane = screen.getByTestId('agents-lane');
    expect(lane.getAttribute('data-show-completed')).toBe('true');
    expect(screen.queryByRole('button', { name: /Completed/ })).toBeNull();
  });

  it('does not mount an inspector rail beside the list', () => {
    render(<AgentsPane session={SESSION} meta={undefined} />);

    expect(screen.queryByRole('separator', { name: 'Resize inspector panel' })).toBeNull();
  });
});
