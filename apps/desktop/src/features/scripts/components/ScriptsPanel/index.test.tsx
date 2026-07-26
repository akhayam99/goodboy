// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

type Script = {
  readonly id: string;
  readonly name: string;
  readonly body: string;
};

const { state } = vi.hoisted(() => ({
  state: {
    scripts: [] as ReadonlyArray<Script>,
    loadScripts: vi.fn(async () => undefined),
    saveScript: vi.fn(async () => undefined),
    deleteScript: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      workspaceScripts: Record<string, ReadonlyArray<Script>>;
      loadScripts: typeof state.loadScripts;
      saveScript: typeof state.saveScript;
      deleteScript: typeof state.deleteScript;
    }) => T,
  ) =>
    selector({
      workspaceScripts: { 'ws-1': state.scripts },
      loadScripts: state.loadScripts,
      saveScript: state.saveScript,
      deleteScript: state.deleteScript,
    }),
}));

import { ScriptsPanel } from './index';

beforeEach(() => {
  state.scripts = [];
  state.loadScripts = vi.fn(async () => undefined);
  state.saveScript = vi.fn(async () => undefined);
  state.deleteScript = vi.fn(async () => undefined);
});
afterEach(cleanup);

describe('ScriptsPanel', () => {
  it('loads scripts on mount and renders the empty hint when none exist', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    expect(state.loadScripts).toHaveBeenCalledWith('ws-1');
    expect(screen.getByText(/no scripts yet/i)).toBeDefined();
    expect(
      screen.getByText(/scripts are shared across every session of this workspace/i),
    ).toBeDefined();
  });

  it('reveals the editor when "New script" is clicked', () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    expect(screen.getByPlaceholderText(/script name/i)).toBeDefined();
  });

  it('saves a new script via store action when filled in', async () => {
    render(<ScriptsPanel workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByRole('button', { name: /new script/i }));
    fireEvent.change(screen.getByPlaceholderText(/script name/i), {
      target: { value: 'copy env' },
    });
    fireEvent.change(screen.getByPlaceholderText(/cp \.\.\/main\/\.env/i), {
      target: { value: 'cp ../main/.env .env' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(state.saveScript).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      id: undefined,
      name: 'copy env',
      body: 'cp ../main/.env .env',
    });
  });
});
