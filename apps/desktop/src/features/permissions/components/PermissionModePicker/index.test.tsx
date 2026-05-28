// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { setModeMock } = vi.hoisted(() => ({
  setModeMock: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: { setSessionPermissionMode: typeof setModeMock }) => T) =>
    selector({ setSessionPermissionMode: setModeMock }),
}));

import { PermissionModePicker, permissionModeMeta } from './index';

function makeSession(): Session {
  return { id: 'sess-1', permissionMode: 'default' } as Session;
}

beforeEach(() => {
  setModeMock.mockReset();
});
afterEach(cleanup);

describe('PermissionModePicker', () => {
  it('shows the current mode label as trigger', () => {
    render(<PermissionModePicker session={makeSession()} />);
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('opens a dialog with all 4 mode options when clicked', () => {
    render(<PermissionModePicker session={makeSession()} />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
    expect(screen.getByText('Bypass')).toBeDefined();
    expect(screen.getByText('Edits')).toBeDefined();
    expect(screen.getByText('Plan')).toBeDefined();
  });

  it('updates session mode when a different option is picked', () => {
    render(<PermissionModePicker session={makeSession()} />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    fireEvent.click(screen.getByText('Edits'));
    expect(setModeMock).toHaveBeenCalledWith('sess-1', 'acceptEdits');
  });
});

describe('permissionModeMeta', () => {
  it('returns the meta for a known mode', () => {
    expect(permissionModeMeta('plan').label).toBe('Plan');
  });
});
