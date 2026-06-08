// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { savePhaseTemplate: () => Promise<void> }) => T) =>
    selector({ savePhaseTemplate: vi.fn(async () => undefined) }),
}));

import { WorkflowPlanner } from './index';

afterEach(cleanup);

describe('WorkflowPlanner', () => {
  it('renders the planner with a Generate plan button disabled until a process is typed', () => {
    render(
      <WorkflowPlanner
        workspaceId={'ws-1' as never}
        providerId="anthropic"
        initialProcess=""
        onWorkflowReady={vi.fn()}
      />,
    );
    const btn = screen.getByRole('button', { name: /generate plan/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('mentions the provider hint in the footer', () => {
    render(
      <WorkflowPlanner
        workspaceId={'ws-1' as never}
        providerId="anthropic"
        initialProcess=""
        onWorkflowReady={vi.fn()}
      />,
    );
    expect(screen.getByText(/cheap-tier · anthropic/i)).toBeDefined();
  });
});
