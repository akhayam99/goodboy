import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';

type CreateSession = (input: Readonly<Record<string, unknown>>) => Promise<{
  session: { id: string; goal: string };
}>;

const h = vi.hoisted(() => ({
  createSession: vi.fn<CreateSession>(async () => ({
    session: { id: 'session-9', goal: 'Fix the flake' },
  })),
  showToast: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: { createSession: typeof h.createSession }) => T) =>
    selector({ createSession: h.createSession }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: h.showToast }),
}));

import { LaunchSessionPanel } from './index';

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

const EXTERNAL_TASK = {
  provider: 'gitlab' as const,
  externalId: '71',
  identifier: 'acme/web#7',
  url: 'https://gitlab.com/acme/web/-/issues/7',
  title: 'Fix the flake',
};

const renderPanel = () =>
  render(
    <LaunchSessionPanel
      workspaceId={WORKSPACE_ID}
      linkedSessionId={null}
      goalSeed="Fix the flake"
      externalTask={EXTERNAL_TASK}
      onClose={vi.fn()}
    />,
  );

beforeEach(() => {
  h.createSession.mockClear();
  h.showToast.mockClear();
});

afterEach(cleanup);

describe('LaunchSessionPanel', () => {
  it('launches without a project and omits project configuration', async () => {
    renderPanel();

    const launchButton = screen.getByRole('button', { name: /Launch session/i });
    expect(launchButton.getAttribute('disabled')).toBeNull();
    expect(screen.queryByText('Which project?')).toBeNull();

    fireEvent.click(launchButton);

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
    expect(h.createSession.mock.calls[0]?.[0]).toEqual({
      workspaceId: WORKSPACE_ID,
      goal: 'Fix the flake',
      externalTasks: [EXTERNAL_TASK],
    });
  });

  it('launches on the keyboard submit shortcut', async () => {
    renderPanel();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Session goal' }), {
      key: 'Enter',
      metaKey: true,
    });

    await waitFor(() => expect(h.createSession).toHaveBeenCalledOnce());
  });

  it('requires a non-empty goal', () => {
    renderPanel();

    fireEvent.change(screen.getByRole('textbox', { name: 'Session goal' }), {
      target: { value: '   ' },
    });

    expect(screen.getByRole('button', { name: /Launch session/i }).getAttribute('disabled')).toBe(
      '',
    );
  });
});
