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

vi.mock('../../../../../store', () => ({
  useAppStore: <T,>(
    selector: (s: {
      setSessionSort: typeof state.setSessionSort;
      setSessionGroup: typeof state.setSessionGroup;
    }) => T,
  ) => selector({ setSessionSort: state.setSessionSort, setSessionGroup: state.setSessionGroup }),
  useSessionViewPrefs: () => state.prefs,
}));

import { SessionViewMenu } from '.';

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
    expect(screen.getByText('Stage')).toBeDefined();
  });

  it('dispatches setSessionSort when a sort option is clicked', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);
    fireEvent.click(screen.getByLabelText(/display options/i));
    fireEvent.click(screen.getByText('A–Z'));
    expect(state.setSessionSort).toHaveBeenCalledWith('ws-1', 'goal');
  });

  it('closes on escape and returns focus to the trigger', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);
    const trigger = screen.getByLabelText(/display options/i);

    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: 'Session display options' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('menu', { name: 'Session display options' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when the backdrop is clicked', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByLabelText(/display options/i));
    const backdrop = document.body.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();

    fireEvent.click(backdrop as Element);

    expect(screen.queryByRole('menu', { name: 'Session display options' })).toBeNull();
  });

  it('opens on the named popover scale rather than the raw z-30 and z-40 it carried before', () => {
    render(<SessionViewMenu workspaceId={'ws-1' as never} />);

    fireEvent.click(screen.getByLabelText(/display options/i));

    expect(document.body.querySelector('.z-popover-backdrop')).not.toBeNull();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();
    expect(document.body.querySelector('.z-30')).toBeNull();
    expect(document.body.querySelector('.z-40')).toBeNull();
  });
});
