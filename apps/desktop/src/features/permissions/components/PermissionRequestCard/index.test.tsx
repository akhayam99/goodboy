// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

const { toastMock } = vi.hoisted(() => ({ toastMock: vi.fn() }));

vi.mock('../../../../shared/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type WorkspaceId,
} from '@goodboy/types';
import { aSession, aWorkspace, anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import type { TranscriptItem } from '../../../chat/utils/transcript-items';
import { PermissionRequestCard } from './index';

const SESSION_ID = brandId<SessionId>({ value: 'sess' });
const AGENT_ID = brandId<AgentId>({ value: 'agent' });
const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'ws-1' });

const allowAndContinueMock = vi.fn(async () => undefined);
const resolveMock = vi.fn(async () => undefined);
const denyWithReasonMock = vi.fn(async () => undefined);
const reportErrorMock = vi.fn(async () => undefined);

let useAppStore: Awaited<ReturnType<typeof importStore>>;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

type ItemOverrides = Partial<Extract<TranscriptItem, { kind: 'permission_request' }>>;

type ItemParams = {
  readonly over?: ItemOverrides;
};

const makeItem = ({ over = {} }: ItemParams = {}): Extract<
  TranscriptItem,
  { kind: 'permission_request' }
> => ({
  kind: 'permission_request',
  key: 'perm-tu-1',
  at: brandId<IsoDateTime>({ value: '2026-05-28T03:00:00Z' }),
  toolUseId: 'tu-1',
  toolName: 'Bash',
  runId: brandId<ProviderRunId>({ value: 'run-1' }),
  input: { command: 'pnpm test --filter ledger-core' },
  ...over,
});

beforeEach(async () => {
  await resetStoryStore();
  allowAndContinueMock.mockReset().mockResolvedValue(undefined);
  resolveMock.mockReset().mockResolvedValue(undefined);
  denyWithReasonMock.mockReset().mockResolvedValue(undefined);
  toastMock.mockReset();
  reportErrorMock.mockClear();
  useAppStore.setState({
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, permissionMode: 'default' })],
    workspaces: [aWorkspace({ id: WORKSPACE_ID, name: 'Harborline' })],
    sessionPhaseRuns: {
      [SESSION_ID]: [
        anAgent({ id: AGENT_ID, sessionId: SESSION_ID, kind: 'implementer', name: 'Fix rounding' }),
      ],
    },
    allowAndContinue: allowAndContinueMock,
    resolvePermissionRequest: resolveMock,
    denyWithReason: denyWithReasonMock,
    reportError: reportErrorMock,
  });
});
afterEach(cleanup);

describe('PermissionRequestCard', () => {
  it('names the asking agent, the exact command and the mode that asked, with no clock', () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    expect(screen.getByText(/Implementer wants to run a command/)).toBeDefined();
    expect(screen.getByText('pnpm test --filter ledger-core')).toBeDefined();
    expect(screen.getByText(/is on/)).toBeDefined();
    expect(screen.queryByText(/blocked by/)).toBeNull();
    expect(screen.queryByText(/\d{2}:\d{2}/)).toBeNull();
  });

  it('renders no actions when sessionId is missing', () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={null} agentId={null} />);
    expect(screen.queryByRole('button', { name: 'Allow and continue' })).toBeNull();
  });

  it('always-allow button names the command prefix, not the whole tool', () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    expect(screen.getByRole('button', { name: 'Always allow "pnpm test"' })).toBeDefined();
  });

  it('always-allow button for a file edit names the workspace', () => {
    render(
      <PermissionRequestCard
        item={makeItem({ over: { toolName: 'Edit', input: { file_path: '/repo/src/refund.ts' } } })}
        sessionId={SESSION_ID}
        agentId={AGENT_ID}
      />,
    );
    expect(screen.getByRole('button', { name: 'Always allow edits in Harborline' })).toBeDefined();
  });

  it('allow and continue grants exactly that call and resumes the turn', async () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow and continue' }));
    });
    expect(allowAndContinueMock).toHaveBeenCalledWith(
      expect.objectContaining({ toolUseId: 'tu-1', toolName: 'Bash' }),
    );
  });

  it('always-allow writes a workspace-scoped command-prefix rule', async () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
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
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
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
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'More permission actions' }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Allow all commands in this session',
      'Always allow "pnpm test" everywhere',
      'Deny and tell Implementer why…',
    ]);
    const menu = screen.getByRole('menu', { name: 'More permission actions' });
    expect(document.activeElement?.textContent).toBe('Allow all commands in this session');
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement?.textContent).toBe('Deny and tell Implementer why…');
  });

  it('allows all commands in this session from the overflow', async () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'More permission actions' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Allow all commands in this session' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'session' }));
  });

  it('writes the global prefix rule only after its popover confirm, anchored to the overflow', async () => {
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'More permission actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Always allow "pnpm test" everywhere' }));

    expect(resolveMock).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', {
      name: 'Always allow "pnpm test" in every workspace?',
    });
    expect(screen.queryByRole('menu')).toBeNull();
    const confirm = within(dialog).getByRole('group');
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
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'More permission actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deny and tell Implementer why…' }));
    fireEvent.change(screen.getByPlaceholderText('Say why, so it does not try again this way'), {
      target: { value: 'this touches production data' },
    });
    const dialog = screen.getByRole('dialog', { name: 'More permission actions' });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Deny' }));
    });
    expect(denyWithReasonMock).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'this touches production data' }),
    );
  });

  it('reports a failed answer to the log and keeps the card open', async () => {
    allowAndContinueMock.mockRejectedValueOnce(new Error('database is locked'));
    render(<PermissionRequestCard item={makeItem()} sessionId={SESSION_ID} agentId={AGENT_ID} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow and continue' }));
    });
    expect(reportErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't answer the Bash request" }),
    );
    expect(screen.getByRole('button', { name: 'Allow and continue' })).toBeDefined();
  });
});
