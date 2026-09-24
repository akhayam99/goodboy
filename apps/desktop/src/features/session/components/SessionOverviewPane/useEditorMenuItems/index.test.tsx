// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
    loadDetectedEditors: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(async () => undefined),
}));

import { openInEditor } from '../../../../../shared/lib/editor';
import { useEditorMenuItems } from '.';

type ItemsProps = {
  readonly worktreePath: string | null;
};

const Items = ({ worktreePath }: ItemsProps) => {
  const items = useEditorMenuItems({ worktreePath });
  return (
    <div>
      {items.map((item) =>
        item.kind === 'item' ? (
          <button key={item.key} type="button" disabled={item.disabled} onClick={item.onClick}>
            {item.label}
          </button>
        ) : (
          <span key={item.key}>{item.kind === 'separator' ? '' : item.label}</span>
        ),
      )}
    </div>
  );
};

beforeEach(() => {
  state.sessionWorktrees = {};
  state.detectedEditors = [];
  state.loadDetectedEditors.mockClear();
  toastMock.mockReset();
  vi.mocked(openInEditor).mockClear();
});
afterEach(cleanup);

describe('useEditorMenuItems', () => {
  it('lists the detected reference editors under one header, then copy path', () => {
    state.detectedEditors = [
      { binary: 'code', label: 'VS Code' },
      { binary: 'zed', label: 'Zed' },
    ];
    render(<Items worktreePath="/api" />);

    expect(screen.getByText('Open in editor')).toBeDefined();
    expect(screen.getByRole('button', { name: 'VS Code' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Zed' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeDefined();
  });

  it('opens the given worktree in the chosen editor', () => {
    state.detectedEditors = [{ binary: 'code', label: 'VS Code' }];
    render(<Items worktreePath="/api" />);

    fireEvent.click(screen.getByRole('button', { name: 'VS Code' }));

    expect(openInEditor).toHaveBeenCalledWith('/api', 'code');
  });

  it('says no editor was detected when none is known', () => {
    render(<Items worktreePath="/api" />);
    expect(
      screen.getByRole('button', { name: 'No editor detected' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('disables every action without a worktree', () => {
    state.detectedEditors = [{ binary: 'code', label: 'VS Code' }];
    render(<Items worktreePath={null} />);
    expect(screen.getByRole('button', { name: 'Copy path' }).hasAttribute('disabled')).toBe(true);
  });

  it('loads detected editors once when none are known yet', () => {
    render(<Items worktreePath="/api" />);
    expect(state.loadDetectedEditors).toHaveBeenCalledOnce();
  });

  it('does not reload detected editors once some are already known', () => {
    state.detectedEditors = [{ binary: 'code', label: 'VS Code' }];
    render(<Items worktreePath="/api" />);
    expect(state.loadDetectedEditors).not.toHaveBeenCalled();
  });
});
