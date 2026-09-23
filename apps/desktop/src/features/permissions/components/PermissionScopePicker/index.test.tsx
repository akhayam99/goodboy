// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const { resolveMock, toastMock, reportErrorMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(async () => undefined),
  toastMock: vi.fn(),
  reportErrorMock: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      resolvePermissionRequest: typeof resolveMock;
      reportError: typeof reportErrorMock;
    }) => T,
  ) => selector({ resolvePermissionRequest: resolveMock, reportError: reportErrorMock }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

import { PermissionScopePicker } from './index';

const props = {
  sessionId: 'sess' as never,
  agentId: 'agent' as never,
  toolUseId: 'tool-1',
  toolName: 'bash',
  runId: 'run-1' as never,
  onResolved: vi.fn(),
};

beforeEach(() => {
  resolveMock.mockReset().mockResolvedValue(undefined);
  toastMock.mockReset();
  reportErrorMock.mockClear();
  props.onResolved = vi.fn();
});
afterEach(cleanup);

describe('PermissionScopePicker', () => {
  it('leads with allow for this session and keeps once and deny beside it', () => {
    render(<PermissionScopePicker {...props} />);

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['Allow for this session', 'Allow once', 'Deny', 'More']);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Allow for this session' }),
    );
  });

  it('never steals focus from a field the user is typing in', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    render(<PermissionScopePicker {...props} />);

    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it('resolves the session scope from the primary action', async () => {
    render(<PermissionScopePicker {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow for this session' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'session' }));
    expect(props.onResolved).toHaveBeenCalledOnce();
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('says a deny holds for the rest of the session', async () => {
    render(<PermissionScopePicker {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    });
    expect(toastMock).toHaveBeenCalledWith('info', 'bash denied for the rest of this session');
  });

  it('reports a failed answer to the log and keeps the picker', async () => {
    resolveMock.mockRejectedValueOnce(new Error('database is locked'));
    render(<PermissionScopePicker {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Allow for this session' }));
    });
    expect(reportErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't answer the bash request" }),
    );
    expect(props.onResolved).not.toHaveBeenCalled();
  });

  it.each([
    ['Allow once', 'once'],
    ['Deny', 'deny'],
  ])('maps %s to the %s scope', async (label, scope) => {
    render(<PermissionScopePicker {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: label }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope }));
  });

  it('shows the broader scopes only after opening More', () => {
    render(<PermissionScopePicker {...props} />);
    expect(screen.queryByRole('menuitem')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    expect(screen.getAllByRole('menuitem').map((item) => item.firstChild?.textContent)).toEqual([
      'Allow for this project',
      'Allow for this workspace',
      'Allow in every workspace',
    ]);
  });

  it.each([
    [/allow for this project/i, 'project'],
    [/allow for this workspace/i, 'workspace'],
  ])('writes %s immediately', async (name, scope) => {
    render(<PermissionScopePicker {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope }));
  });

  it('writes the global rule only after its inline confirm', async () => {
    render(<PermissionScopePicker {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /allow in every workspace/i }));

    expect(resolveMock).not.toHaveBeenCalled();
    const confirm = screen.getByRole('group', { name: 'Allow bash in every workspace?' });
    await act(async () => {
      fireEvent.click(within(confirm).getByRole('button', { name: 'Allow everywhere' }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'global' }));
  });

  it('returns to the scope list when the global confirm is cancelled', () => {
    render(<PermissionScopePicker {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /allow in every workspace/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(resolveMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });
});
