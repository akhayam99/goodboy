// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('opens a dialog with all 4 mode options when clicked', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
    expect(screen.getByText('Bypass')).toBeDefined();
    expect(screen.getByText('Edits')).toBeDefined();
    expect(screen.getByText('Plan')).toBeDefined();
  });

  it('updates session mode when a different option is picked', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    fireEvent.click(screen.getByText('Edits'));
    expect(setModeMock).toHaveBeenCalledWith('sess-1', 'acceptEdits');
  });

  it.each(['cursor', 'gemini'] as const)(
    'flags that the mode is not enforced for %s',
    (provider) => {
      render(<PermissionModePicker session={makeSession()} activeProvider={provider} />);
      fireEvent.click(screen.getByRole('button', { name: /default/i }));
      expect(screen.getByText(/not enforced for cursor and gemini/i)).toBeDefined();
    },
  );

  it.each(['anthropic', 'codex'] as const)('does not flag enforcement for %s', (provider) => {
    render(<PermissionModePicker session={makeSession()} activeProvider={provider} />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.queryByText(/not enforced for cursor and gemini/i)).toBeNull();
  });

  it('closes on Escape', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /permission mode/i })).toBeNull();
  });

  it('closes on a mousedown outside the picker', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog', { name: /permission mode/i })).toBeNull();
  });

  it('escapes clipping ancestors through a fixed body portal', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    const panel = screen.getByRole('dialog', { name: /permission mode/i });
    expect(panel.className).toContain('fixed');
    expect(panel.className).toContain('z-popover');
    expect(panel.closest('[data-dropdown-portal]')?.parentElement).toBe(document.body);
  });

  it('opens on the goodboy:open-permission-picker event', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    act(() => {
      window.dispatchEvent(new CustomEvent('goodboy:open-permission-picker'));
    });
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
  });
});

describe('permissionModeMeta', () => {
  it('returns the meta for a known mode', () => {
    expect(permissionModeMeta('plan').label).toBe('Plan');
  });
});
