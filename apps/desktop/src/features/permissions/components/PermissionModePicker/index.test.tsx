// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Session } from '@goodboy/types';

const { setModeMock, state } = vi.hoisted(() => ({
  setModeMock: vi.fn(async () => undefined),
  state: {
    workspaces: [] as ReadonlyArray<{ id: string; defaultPermissionMode?: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      setSessionPermissionMode: typeof setModeMock;
      workspaces: typeof state.workspaces;
    }) => T,
  ) => selector({ setSessionPermissionMode: setModeMock, workspaces: state.workspaces }),
}));

import { PermissionModePicker } from './index';

const makeSession = (): Session => {
  return { id: 'sess-1', workspaceId: 'ws-1', permissionMode: 'default' } as Session;
};

const openPicker = () => fireEvent.click(screen.getByRole('button', { name: /ask first/i }));

beforeEach(() => {
  setModeMock.mockReset();
  state.workspaces = [];
});
afterEach(cleanup);

describe('PermissionModePicker', () => {
  it('names the current mode in words on the trigger', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    expect(screen.getByText('Ask first')).toBeDefined();
  });

  it('offers four modes and leaves out do not ask', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
    expect(screen.getByText('Read only')).toBeDefined();
    expect(screen.getByText('Edits allowed')).toBeDefined();
    expect(screen.getByText('Full access')).toBeDefined();
    expect(screen.queryByText("Don't ask")).toBeNull();
  });

  it('marks the workspace default', () => {
    state.workspaces = [{ id: 'ws-1', defaultPermissionMode: 'plan' }];
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
    expect(screen.getByText('Read only').parentElement?.textContent).toContain('Default');
    expect(screen.getByText('Workspace default: Read only')).toBeDefined();
  });

  it('reads a do not ask session as ask first', () => {
    render(
      <PermissionModePicker
        session={{ ...makeSession(), permissionMode: 'dontAsk' }}
        activeProvider="anthropic"
      />,
    );
    expect(screen.getByText('Ask first')).toBeDefined();
  });

  it('updates session mode when a different option is picked', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
    fireEvent.click(screen.getByText('Edits allowed'));
    expect(setModeMock).toHaveBeenCalledWith('sess-1', 'acceptEdits');
  });

  it('disables the modes cursor cannot honor and says why', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="cursor" />);
    openPicker();
    const edits = screen.getByText('Edits allowed').closest('button');
    expect(edits?.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText("Not available on Cursor: it can't allow edits and block commands"),
    ).toBeDefined();
    expect(screen.getByText('Full access').closest('button')?.hasAttribute('disabled')).toBe(false);
    fireEvent.click(screen.getByText('Edits allowed'));
    expect(setModeMock).not.toHaveBeenCalled();
  });

  it('keeps edits allowed open on codex but not ask first', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="codex" />);
    openPicker();
    expect(screen.getByText('Edits allowed').closest('button')?.hasAttribute('disabled')).toBe(
      false,
    );
    expect(screen.getAllByText("Not available on Codex: it can't stop to ask you")).toHaveLength(1);
  });

  it('disables nothing on claude', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
    expect(screen.queryByText(/not available on/i)).toBeNull();
    expect(screen.queryByText(/not enforced/i)).toBeNull();
  });

  it('closes on Escape', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
    expect(screen.getByRole('dialog', { name: /permission mode/i })).toBeDefined();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /permission mode/i })).toBeNull();
  });

  it('closes on a mousedown outside the picker', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('dialog', { name: /permission mode/i })).toBeNull();
  });

  it('escapes clipping ancestors through a fixed body portal', () => {
    render(<PermissionModePicker session={makeSession()} activeProvider="anthropic" />);
    openPicker();
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
