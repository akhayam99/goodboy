// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { store, panelProps, showToast } = vi.hoisted(() => ({
  store: {
    setSessionActiveProject: vi.fn(async () => undefined),
    setSessionActiveMount: vi.fn(async () => undefined),
  },
  panelProps: [] as Array<Record<string, unknown>>,
  showToast: vi.fn(),
}));

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('../../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast }),
}));

vi.mock('../../../../worktree/BranchSwitchPanel', () => ({
  BranchSwitchPanel: (props: Record<string, unknown>) => {
    panelProps.push(props);
    return <div data-testid="branch-switch-panel" />;
  },
}));

import { ProjectBranchChip } from './ProjectBranchChip';

const renderChip = ({ canSwitch = true }: { readonly canSwitch?: boolean } = {}) =>
  render(
    <ProjectBranchChip
      sessionId={'session-1' as never}
      mountId={'mount-2' as never}
      branch="ak/sibling"
      canSwitch={canSwitch}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  panelProps.length = 0;
});

afterEach(cleanup);

describe('ProjectBranchChip', () => {
  it('opens the switch panel on its own mount without moving the write destination', () => {
    renderChip();

    fireEvent.click(screen.getByRole('button', { name: 'Switch branch ak/sibling' }));

    expect(panelProps.at(-1)).toMatchObject({ sessionId: 'session-1', mountId: 'mount-2' });
    expect(store.setSessionActiveProject).not.toHaveBeenCalled();
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();
  });

  it('makes the whole chip the switch control, with no separate pencil', () => {
    renderChip();

    expect(screen.queryByRole('button', { name: 'Switch branch' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy branch ak/sibling' })).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('copies the branch name when switching is not possible, without a toast', async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderChip({ canSwitch: false });

    fireEvent.click(screen.getByRole('button', { name: 'Copy branch ak/sibling' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ak/sibling'));
    expect(screen.queryByTestId('branch-switch-panel')).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
  });
});
