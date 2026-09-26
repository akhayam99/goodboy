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

const makeSession = (): Session => {
  return { id: 'sess-1', permissionMode: 'default' } as Session;
};

beforeEach(() => {
  setModeMock.mockReset();
});
afterEach(cleanup);

describe('PermissionModePicker', () => {
  it('shows the current mode label as trigger', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('opens a dialog with all 5 mode options when clicked', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
    expect(screen.getByText('Bypass')).toBeDefined();
    expect(screen.getByText('Edits')).toBeDefined();
    expect(screen.getByText("Don't ask")).toBeDefined();
    expect(screen.getByText('Plan')).toBeDefined();
  });

  it('updates session mode when a different option is picked', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    fireEvent.click(screen.getByText('Edits'));
    expect(setModeMock).toHaveBeenCalledWith('sess-1', 'acceptEdits');
  });

  it('disables the modes cursor cannot honor and says why', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="cursor" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    const edits = screen.getByText('Edits').closest('button');
    expect(edits?.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText("Not available on Cursor: it can't allow edits and block commands"),
    ).toBeDefined();
    expect(screen.getByText('Bypass').closest('button')?.hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByText('Edits'));
    expect(setModeMock).not.toHaveBeenCalled();
  });

  it('keeps edits allowed open on codex but not ask first', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="codex" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.getByText('Edits').closest('button')?.hasAttribute('disabled')).toBe(false);
    expect(screen.getAllByText("Not available on Codex: it can't stop to ask you").length).toBe(2);
  });

  it('disables nothing on claude', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    fireEvent.click(screen.getByRole('button', { name: /default/i }));
    expect(screen.queryByText(/not available on/i)).toBeNull();
    expect(screen.queryByText(/not enforced/i)).toBeNull();
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

  it('represents dontAsk as restrictive instead of bypass', () => {
    const meta = permissionModeMeta('dontAsk');

    expect(meta.label).toBe("Don't ask");
    expect(meta.tone).toBe('neutral');
  });
});
