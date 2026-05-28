// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { resolveMock, toastMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(async () => undefined),
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { resolvePermissionRequest: typeof resolveMock }) => T) =>
    selector({ resolvePermissionRequest: resolveMock }),
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
  props.onResolved = vi.fn();
});
afterEach(cleanup);

describe('PermissionScopePicker', () => {
  it('renders one button per scope', () => {
    render(<PermissionScopePicker {...props} />);
    ['approve global', 'approve workspace', 'approve session', 'approve once', 'deny'].forEach(
      (label) => {
        expect(screen.getByRole('button', { name: label })).toBeDefined();
      },
    );
  });

  it('resolves the request and notifies onResolved when a scope is picked', async () => {
    render(<PermissionScopePicker {...props} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /approve session/i }));
    });
    expect(resolveMock).toHaveBeenCalledWith(expect.objectContaining({ scope: 'session' }));
    expect(props.onResolved).toHaveBeenCalledOnce();
    expect(toastMock).toHaveBeenCalledWith(
      'success',
      expect.stringMatching(/allow for this session/i),
    );
  });
});
