// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { DEFAULT_BRANCH_PREFIX, settingBranchPrefix } from '../../../settings/settings';

const { state } = vi.hoisted(() => ({
  state: {
    loadSetting: vi.fn(async (_key: string): Promise<string | null> => null),
    saveSetting: vi.fn(async () => undefined),
    setWorkspaceOverrides: vi.fn(async () => undefined),
    workspaceOverrides: {} as Record<string, unknown>,
    providers: [] as ReadonlyArray<{ id: ProviderId; connection: string }>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('zustand/react/shallow', () => ({
  useShallow: <T,>(selector: T) => selector,
}));

vi.mock('../../../session/components/VerbositySelect', () => ({
  VerbositySelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button type="button" data-testid="verbosity" onClick={() => onChange('terse')}>
      verbosity
    </button>
  ),
}));

const WS_ID = 'ws-1' as WorkspaceId;

beforeEach(() => {
  state.loadSetting = vi.fn(async () => null);
  state.saveSetting = vi.fn(async () => undefined);
  state.setWorkspaceOverrides = vi.fn(async () => undefined);
  state.workspaceOverrides = {};
  state.providers = [
    { id: 'anthropic', connection: 'connected' },
    { id: 'cursor', connection: 'connected' },
    { id: 'codex', connection: 'disconnected' },
    { id: 'gemini', connection: 'disconnected' },
    { id: 'opencode', connection: 'disconnected' },
    { id: 'openrouter', connection: 'disconnected' },
  ];
});
afterEach(cleanup);

import { PreferencesStep } from './PreferencesStep';

describe('PreferencesStep', () => {
  it('renders the heading', () => {
    render(<PreferencesStep workspaceId={WS_ID} />);
    expect(screen.getByRole('heading', { name: /set your defaults/i })).toBeDefined();
  });

  describe('without a workspace', () => {
    beforeEach(() => render(<PreferencesStep workspaceId={null} />));

    it('shows the add-workspace empty state instead of the form', () => {
      expect(screen.getByText(/Add a workspace first to set its defaults/i)).toBeDefined();
      expect(screen.queryByLabelText(/branch prefix/i)).toBeNull();
    });

    it('dispatches goodboy:add-workspace when the button is clicked', () => {
      const spy = vi.fn();
      window.addEventListener('goodboy:add-workspace', spy);
      fireEvent.click(screen.getByRole('button', { name: /add workspace/i }));
      expect(spy).toHaveBeenCalledOnce();
      window.removeEventListener('goodboy:add-workspace', spy);
    });
  });

  describe('default provider picker', () => {
    it('disables offline providers and marks them as offline', () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /default provider/i }));
      const codex = screen.getByRole('button', { name: /codex/i }) as HTMLButtonElement;
      const gemini = screen.getByRole('button', { name: /gemini/i }) as HTMLButtonElement;
      expect(codex.disabled).toBe(true);
      expect(gemini.disabled).toBe(true);
      expect(codex.getAttribute('title')).toContain('not connected');
      expect(gemini.getAttribute('title')).toContain('not connected');
    });

    it('leaves connected providers enabled', () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /default provider/i }));
      const cursor = screen.getByRole('button', { name: /cursor/i }) as HTMLButtonElement;
      expect(cursor.disabled).toBe(false);
    });

    it('persists the picked provider through setWorkspaceOverrides', async () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('button', { name: /default provider/i }));
      fireEvent.click(screen.getByRole('button', { name: /cursor/i }));
      await waitFor(() =>
        expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
          WS_ID,
          expect.objectContaining({ defaultProviderId: 'cursor' }),
        ),
      );
    });
  });

  describe('branch prefix', () => {
    it('sanitizes the typed value to lowercase alphanumerics', () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      const input = screen.getByLabelText(/branch prefix/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'AB 12!#cd' } });
      expect(input.value).toBe('ab12cd');
    });

    it('commits the sanitized prefix on blur', async () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      const input = screen.getByLabelText(/branch prefix/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'feat' } });
      fireEvent.blur(input);
      await waitFor(() =>
        expect(state.saveSetting).toHaveBeenCalledWith(settingBranchPrefix(WS_ID), 'feat'),
      );
    });

    it('falls back to the default when emptied', async () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      const input = screen.getByLabelText(/branch prefix/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'feat' } });
      fireEvent.blur(input);
      await waitFor(() => expect(state.saveSetting).toHaveBeenCalled());
      state.saveSetting = vi.fn(async () => undefined);
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);
      await waitFor(() => expect(input.value).toBe(DEFAULT_BRANCH_PREFIX));
    });

    it('is hidden with repository-specific defaults for simple workspaces', () => {
      render(<PreferencesStep workspaceId={WS_ID} workspaceKind="simple" />);
      expect(screen.queryByLabelText(/branch prefix/i)).toBeNull();
      expect(screen.queryByRole('switch')).toBeNull();
      expect(state.loadSetting).not.toHaveBeenCalled();
    });
  });

  describe('parallel scouts toggle', () => {
    it('starts on when the workspace has no override', () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    });

    it('persists scoutFanout when switched off', async () => {
      render(<PreferencesStep workspaceId={WS_ID} />);
      fireEvent.click(screen.getByRole('switch'));
      await waitFor(() =>
        expect(state.setWorkspaceOverrides).toHaveBeenCalledWith(
          WS_ID,
          expect.objectContaining({ scoutFanout: false }),
        ),
      );
    });
  });
});
