// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { REST_HOVER_REST_MS } from '@goodboy/ui';
import { brandId, type SessionId } from '@goodboy/types';

vi.mock('../../../actions/components/ObjectMenuProvider/ObjectContextMenu', () => ({
  ObjectContextMenu: ({ onClose }: { readonly onClose: () => void }) => (
    <div role="menu">
      <button type="button" onClick={onClose}>
        Close menu
      </button>
    </div>
  ),
}));

import { ObjectMenuProvider } from '../../../actions/components/ObjectMenuProvider';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { useHoverCardTarget } from '../SessionHoverCard/useHoverCardTarget';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger-core' });

const BoardCardProbe = () => {
  const hover = useHoverCardTarget();
  const menu = useObjectMenuTrigger({ target: { kind: 'session', sessionId: SESSION_ID } });
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="ledger-core card"
        onContextMenu={menu.onContextMenu}
        onKeyDown={menu.onKeyDown}
        onMouseEnter={(event) =>
          hover.enter({ sessionId: SESSION_ID, anchor: event.currentTarget })
        }
        onMouseLeave={hover.leave}
      />
      {hover.target === null ? null : <div role="tooltip">ledger-core hover card</div>}
    </>
  );
};

const renderBoard = () =>
  render(
    <ObjectMenuProvider>
      <BoardCardProbe />
    </ObjectMenuProvider>,
  );

const card = (): HTMLElement => screen.getByRole('button', { name: 'ledger-core card' });

const restOnCard = (): void => {
  fireEvent.mouseEnter(card());
  act(() => {
    vi.advanceTimersByTime(REST_HOVER_REST_MS);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('board hover card under an open menu', () => {
  it('shows no hover card on a resting pointer while the right-click menu is open', () => {
    renderBoard();

    fireEvent.contextMenu(card());
    screen.getByRole('menu');
    restOnCard();

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes an open hover card when Shift F10 opens the menu, and hovers again once it closes', () => {
    renderBoard();
    restOnCard();
    screen.getByRole('tooltip');

    fireEvent.keyDown(card(), { key: 'F10', shiftKey: true });
    expect(screen.queryByRole('tooltip')).toBeNull();
    restOnCard();
    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
    fireEvent.mouseLeave(card());
    restOnCard();
    screen.getByRole('tooltip');
  });
});
