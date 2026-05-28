// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    setSessionSort: vi.fn(),
    setSessionGroup: vi.fn(),
    prefs: { sort: 'updatedAt' as const, group: 'none' as const },
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      setSessionSort: typeof state.setSessionSort;
      setSessionGroup: typeof state.setSessionGroup;
    }) => T,
  ) => selector({ setSessionSort: state.setSessionSort, setSessionGroup: state.setSessionGroup }),
  useSessionViewPrefs: () => state.prefs,
}));

import { SessionViewMenu } from './SessionViewMenu';

afterEach(cleanup);

describe('SessionViewMenu', () => {
  it('renders the display-options trigger', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);
    expect(screen.getByLabelText(/display options/i)).toBeDefined();
  });

  it('opens the popover and reveals sort + group options', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByLabelText(/display options/i));
    expect(screen.getByText('Recent')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
  });

  it('dispatches setSessionSort when a sort option is clicked', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByLabelText(/display options/i));
    fireEvent.click(screen.getByText('A–Z'));
    expect(state.setSessionSort).toHaveBeenCalledWith('ws-1', 'goal');
  });
});
