// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

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

const renderChip = () =>
  render(
    <ProjectBranchChip
      sessionId={'session-1' as never}
      mountId={'mount-2' as never}
      branch="ak/sibling"
      canSwitch
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

    fireEvent.click(screen.getByRole('button', { name: 'Switch branch' }));

    expect(panelProps.at(-1)).toMatchObject({ sessionId: 'session-1', mountId: 'mount-2' });
    expect(store.setSessionActiveProject).not.toHaveBeenCalled();
    expect(store.setSessionActiveMount).not.toHaveBeenCalled();
  });
});
