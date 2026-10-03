// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { IsoDateTime, PermissionRule, PermissionRuleId, WorkspaceId } from '@goodboy/types';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(async () => undefined),
  upsert: vi.fn(),
  audit: vi.fn(),
  setDefault: vi.fn(async () => undefined),
  reportError: vi.fn(async () => undefined),
  state: {
    workspaceOverrides: {} as Record<string, unknown>,
    settings: {} as Record<string, string>,
    workspaces: [] as ReadonlyArray<{ id: string; name: string; defaultPermissionMode?: string }>,
    sessions: [] as ReadonlyArray<{
      id?: string;
      goal?: string;
      workspaceId: string;
      providerPreference: { defaultProvider: string; enabledProviders?: ReadonlyArray<string> };
    }>,
  },
}));

vi.mock('../../permissions', () => ({
  invokePermissionRuleList: mocks.list,
  invokePermissionRuleDelete: mocks.remove,
  invokePermissionRuleUpsert: mocks.upsert,
  invokePermissionAuditList: mocks.audit,
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (state: Record<string, unknown>) => T) =>
    selector({
      ...mocks.state,
      setWorkspacePermissionDefault: mocks.setDefault,
      reportError: mocks.reportError,
    }),
}));

import { PermissionsSettings } from './index';

const WORKSPACE_ID = 'harborline' as WorkspaceId;

const rule = (overrides: Partial<PermissionRule>): PermissionRule => ({
  id: 'rule-1' as PermissionRuleId,
  scope: 'workspace',
  workspaceId: WORKSPACE_ID,
  pattern: { tool: 'Bash', argsMatcher: 'pnpm test *' },
  decision: 'allow',
  priority: 0,
  createdAt: '2026-09-26T10:00:00.000Z' as IsoDateTime,
  updatedAt: '2026-09-26T10:00:00.000Z' as IsoDateTime,
  ...overrides,
});

const denyPush = rule({
  id: 'rule-2' as PermissionRuleId,
  scope: 'global',
  pattern: { tool: 'Bash', argsMatcher: 'git push *' },
  decision: 'deny',
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.workspaces = [{ id: WORKSPACE_ID, name: 'Harborline' }];
  mocks.state.sessions = [
    {
      id: 'session-1',
      goal: 'Fix ledger rounding',
      workspaceId: WORKSPACE_ID,
      providerPreference: { defaultProvider: 'anthropic' },
    },
    {
      id: 'session-2',
      goal: 'Retry the webhook',
      workspaceId: WORKSPACE_ID,
      providerPreference: { defaultProvider: 'codex' },
    },
  ];
  mocks.audit.mockResolvedValue([]);
  mocks.list.mockImplementation(async ({ scope }: { readonly scope: string }) =>
    scope === 'workspace' ? [rule({})] : [denyPush],
  );
});

afterEach(cleanup);

describe('PermissionsSettings', () => {
  it('starts on full access and lowers the default for new sessions', () => {
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    expect(screen.getByRole('radio', { name: /full access/i }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(screen.getByRole('radio', { name: /read only/i }));
    expect(mocks.setDefault).toHaveBeenCalledWith({ workspaceId: WORKSPACE_ID, mode: 'plan' });
  });

  it('says what each provider does with a mode it cannot honor', () => {
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    const askFirst = screen.getByRole('row', { name: /ask first/i });
    expect(within(askFirst).getAllByText('Runs Read only')).toHaveLength(4);
    const rulesRow = screen.getByRole('row', { name: /^rules/i });
    expect(within(rulesRow).getAllByText('Ignored')).toHaveLength(4);
  });

  it('puts the providers that follow and ignore each rule next to it', async () => {
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    expect(await screen.findByText('Commands starting with "pnpm test"')).toBeDefined();
    expect(screen.getByText('Codex ignore it')).toBeDefined();
    expect(screen.getByText('Codex can still run it')).toBeDefined();
    expect(screen.getByText('All workspaces')).toBeDefined();
  });

  it('warns that a deny rule only stops Claude when another provider runs here', async () => {
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    expect(await screen.findByText('Deny rules only stop Claude.')).toBeDefined();
  });

  it('stays quiet about deny rules when only Claude runs here', async () => {
    mocks.state.sessions = [
      { workspaceId: WORKSPACE_ID, providerPreference: { defaultProvider: 'anthropic' } },
    ];
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    await screen.findByText('Commands starting with "git push"');
    expect(screen.queryByText('Deny rules only stop Claude.')).toBeNull();
  });

  it('removes a rule after an inline confirm', async () => {
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    await screen.findByText('Commands starting with "pnpm test"');
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove rule: Commands starting with "pnpm test"' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith({ id: 'rule-1' }));
    await waitFor(() =>
      expect(screen.queryByText('Commands starting with "pnpm test"')).toBeNull(),
    );
  });

  it('adds a deny rule from a suggestion for every workspace', async () => {
    mocks.upsert.mockResolvedValue(
      rule({
        id: 'rule-3' as PermissionRuleId,
        scope: 'global',
        workspaceId: undefined,
        pattern: { tool: 'Bash', argsMatcher: 'git push --force *' },
        decision: 'deny',
      }),
    );
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);
    await screen.findByText('Commands starting with "pnpm test"');

    fireEvent.click(screen.getByRole('button', { name: 'Add rule' }));
    fireEvent.click(screen.getByRole('button', { name: 'git push' }));
    const form = screen.getByRole('form', { name: 'Add rule' });
    fireEvent.change(within(form).getByRole('textbox', { name: 'Commands starting with' }), {
      target: { value: 'git push --force' },
    });
    fireEvent.click(within(form).getByRole('tab', { name: 'All workspaces' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Add rule' }));

    await waitFor(() =>
      expect(mocks.upsert).toHaveBeenCalledWith({
        scope: 'global',
        patternTool: 'Bash',
        patternArgsMatcher: 'git push --force *',
        decision: 'deny',
        priority: 100,
      }),
    );
    expect(await screen.findByText('Commands starting with "git push --force"')).toBeDefined();
    expect(screen.queryByRole('form', { name: 'Add rule' })).toBeNull();
  });

  it('lists the recent decisions with the command, the session and when', async () => {
    mocks.audit.mockResolvedValue([
      {
        id: 'audit-1',
        sessionId: 'session-1',
        toolName: 'Bash',
        input: { command: 'pnpm test --filter ledger-core' },
        decision: 'allow',
        decidedAt: new Date(Date.now() - 120_000).toISOString(),
      },
    ]);
    render(<PermissionsSettings workspaceId={WORKSPACE_ID} />);

    const list = await screen.findByRole('list', { name: 'Recent decisions' });
    expect(within(list).getByText('Allowed')).toBeDefined();
    expect(within(list).getByText('pnpm test')).toBeDefined();
    expect(within(list).getByText(/session "Fix ledger rounding"/)).toBeDefined();
    expect(mocks.audit).toHaveBeenCalledWith({ sessionIds: ['session-1', 'session-2'] });
  });
});
