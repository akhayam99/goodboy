// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { SessionId } from '@goodboy/types';

const { state, toastMock } = vi.hoisted(() => ({
  state: {
    sessionWorktrees: {} as Record<string, ReadonlyArray<string>>,
    detectedEditors: [] as ReadonlyArray<{ binary: string; label: string }>,
    loadDetectedEditors: vi.fn(async () => undefined),
  },
  toastMock: vi.fn(),
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: toastMock }),
}));

vi.mock('../../../../shared/components/OverflowMenu', () => ({
  OverflowMenu: ({
    label,
    triggerClassName,
    trigger,
    side,
  }: {
    label: string;
    triggerClassName: string;
    trigger: ReactNode;
    side?: string;
  }) => (
    <button type="button" aria-label={label} className={triggerClassName} data-side={side}>
      {trigger}
    </button>
  ),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openInEditor: vi.fn(async () => undefined),
}));

import { EditorMenu } from './EditorMenu';

beforeEach(() => {
  state.sessionWorktrees = {};
  state.detectedEditors = [];
  state.loadDetectedEditors.mockClear();
  toastMock.mockReset();
});
afterEach(cleanup);

describe('EditorMenu', () => {
  it('renders the open-worktree trigger with a visible Open label opening upward', () => {
    render(<EditorMenu sessionId={'sess-1' as SessionId} />);
    const trigger = screen.getByRole('button', { name: /open worktree/i });
    expect(trigger.textContent).toContain('Open');
    expect(trigger.getAttribute('data-side')).toBe('top');
  });

  it('loads detected editors once when none are known yet', () => {
    render(<EditorMenu sessionId={'sess-1' as SessionId} />);
    expect(state.loadDetectedEditors).toHaveBeenCalledOnce();
  });

  it('does not reload detected editors once some are already known', () => {
    state.detectedEditors = [{ binary: 'code', label: 'VS Code' }];
    render(<EditorMenu sessionId={'sess-1' as SessionId} />);
    expect(state.loadDetectedEditors).not.toHaveBeenCalled();
  });
});
