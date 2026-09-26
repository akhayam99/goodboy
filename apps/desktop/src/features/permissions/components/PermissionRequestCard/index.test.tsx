// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import type { Session } from '@goodboy/types';

const { allowAndContinueMock, resolveMock, denyWithReasonMock, toastMock, reportErrorMock } =
  vi.hoisted(() => ({
    allowAndContinueMock: vi.fn(async () => undefined),
    resolveMock: vi.fn(async () => undefined),
    denyWithReasonMock: vi.fn(async () => undefined),
    toastMock: vi.fn(),
    reportErrorMock: vi.fn(async () => undefined),
  }));

const session: Session = {
  id: 'sess' as never,
  workspaceId: 'ws-1' as never,
  goal: 'fix ledger rounding',
  state: { kind: 'idle', lastActivityAt: '2026-05-28T00:00:00Z' as never },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'default',
  autoRun: false,
  titleUserEdited: false,
  workflowRuns: [],
  createdAt: '2026-05-28T00:00:00Z' as never,
  updatedAt: '2026-05-28T00:00:00Z' as never,
};

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      sessions: Session[];
      workspaces: { id: string; name: string }[];
      allowAndContinue: typeof allowAndContinueMock;
      resolvePermissionRequest: typeof resolveMock;
      denyWithReason: typeof denyWithReasonMock;
      reportError: typeof reportErrorMock;
    }) => T,
  ) =>
    selector({
      sessions: [session],
      workspaces: [{ id: 'ws-1', name: 'Harborline' }],
      allowAndContinue: allowAndContinueMock,
      resolvePermissionRequest: resolveMock,
      denyWithReason: denyWithReasonMock,
      reportError: reportErrorMock,
    }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { PermissionRequestCard } from './index';

function makeItem(
  over: Partial<Extract<TranscriptItem, { kind: 'permission_request' }>> = {},
): Extract<TranscriptItem, { kind: 'permission_request' }> {
  return {
    kind: 'permission_request',
    at: '2026-05-28T03:00:00Z',
    toolUseId: 'tu-1',
    toolName: 'Bash',
    runId: 'run-1',
    input: { command: 'pnpm test --filter ledger-core' },
    ...over,
  } as Extract<TranscriptItem, { kind: 'permission_request' }>;
}

beforeEach(() => {
  allowAndContinueMock.mockReset().mockResolvedValue(undefined);
  resolveMock.mockReset().mockResolvedValue(undefined);
  denyWithReasonMock.mockReset().mockResolvedValue(undefined);
  toastMock.mockReset();
  reportErrorMock.mockClear();
});
afterEach(cleanup);

describe('PermissionRequestCard', () => {
  it('names the provider and shows the exact command blocked', () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.getByText(/Claude wants to run/)).toBeDefined();
    expect(screen.getByText('pnpm test --filter ledger-core')).toBeDefined();
    expect(screen.getByText(/blocked by/)).toBeDefined();
  });

  it('renders no actions when sessionId is missing', () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByRole('button', { name: 'Allow and continue' })).toBeNull();
  });

  it('always-allow button names the command prefix, not the whole tool', () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.getByRole('button', { name: 'Always allow "pnpm test"' })).toBeDefined();
  });

  it('always-allow button for a file edit names the workspace', () => {
    render(
      <PermissionRequestCard
        item={makeItem({ toolName: 'Edit', input: { file_path: '/repo/src/refund.ts' } })}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    expect(screen.getByRole('button', { name: 'Always allow edits in Harborline' })).toBeDefined();
  });

  it('allow and continue grants exactly that call and resumes the turn', async () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow and continue' }));
    });
    expect(allowAndContinueMock).toHaveBeenCalledWith(
      expect.objectContaining({ toolUseId: 'tu-1', toolName: 'Bash' }),
    );
  });

  it('always-allow writes a workspace-scoped command-prefix rule', async () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Always allow "pnpm test"' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'workspace',
        pattern: { tool: 'Bash', argsMatcher: 'pnpm test *' },
      }),
    );
  });

  it('deny holds for the rest of the session', async () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'deny' }));
    expect(toastMock).toHaveBeenCalledWith({
      kind: 'info',
      message: 'Bash denied for the rest of this session',
    });
  });

  it('the overflow menu offers the session-wide, everywhere and reasoned-deny escapes', () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More approval actions' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Allow all commands in this session',
      'Always allow "pnpm test" everywhere',
      'Deny and tell Claude why…',
    ]);
  });

  it('allows all commands in this session from the overflow', async () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More approval actions' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Allow all commands in this session' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'session' }));
  });

  it('writes the global prefix rule only after its inline confirm', async () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More approval actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Always allow "pnpm test" everywhere' }));

    expect(resolveMock).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', {
      name: 'Always allow "pnpm test" in every workspace?',
    });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Allow everywhere' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: 'global',
        pattern: { tool: 'Bash', argsMatcher: 'pnpm test *' },
      }),
    );
  });

  it('denies with a reason typed into the overflow', async () => {
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More approval actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deny and tell Claude why…' }));
    fireEvent.change(screen.getByPlaceholderText('Say why, so it does not try again this way'), {
      target: { value: 'this touches production data' },
    });
    const dialog = screen.getByRole('dialog', { name: 'More approval actions' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Deny' }));
    });
    expect(denyWithReasonMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'this touches production data' }),
    );
  });

  it('reports a failed answer to the log and keeps the card open', async () => {
    allowAndContinueMock.mockRejectedValueOnce(new Error('database is locked'));
    render(
      <PermissionRequestCard
        item={makeItem()}
        sessionId={'sess' as never}
        agentId={'agent' as never}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow and continue' }));
    });
    expect(reportErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't answer the Bash request" }),
    );
    expect(screen.getByRole('button', { name: 'Allow and continue' })).toBeDefined();
  });
});
