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

vi.mock('../../../../workspace/components/WorkspacesSidebar/parts/AgentsSection', () => ({
  AgentsSection: ({ showCreateControl }: { readonly showCreateControl?: boolean }) => (
    <div data-testid="agents-section" data-show-create={String(showCreateControl)} />
  ),
}));

vi.mock('../../../../workspace/components/WorkspacesSidebar/parts/SpawnAgentControl', () => ({
  SpawnAgentControl: () => (
    <button type="button" data-testid="header-spawn">
      Create agent
    </button>
  ),
}));

vi.mock('../../AgentInspector', () => ({ AgentInspector: () => null }));

import { AgentsPane } from './AgentsPane';

const SESSION = { id: 'sess-1', workspaceId: 'ws-1' } as unknown as Session;

afterEach(cleanup);

describe('AgentsPane', () => {
  it('hosts the create-agent control in the pane header and hides it from the list', () => {
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
    expect(header?.querySelector('[data-testid="header-spawn"]')).not.toBeNull();
    expect(screen.getByTestId('agents-section').getAttribute('data-show-create')).toBe('false');
  });
});
