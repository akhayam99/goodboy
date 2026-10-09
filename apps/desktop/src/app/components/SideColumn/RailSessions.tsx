import { type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';
import type { Session, SessionId, WorkspaceId } from '@goodboy/types';
import { sessionPlace, useAppStore, useSessions } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { RailFlyout } from './RailFlyout';
import { RailFlyoutBody } from './RailFlyoutBody';
import { RailMoreButton } from './RailMoreButton';
import { RailSessionButton, type RailSessionSign } from './RailSessionButton';
import { isStudioOverSession, type ColumnPlace } from './columnPlace';
import { RAIL_PINNED_LIMIT, useRailPinned } from './useRailPinned';
import { useRailFlyout, type RailFlyoutKey } from './useRailFlyout';

type Props = {
  readonly workspaceId: WorkspaceId | null;
  readonly currentSessionId: SessionId | null;
  readonly place: ColumnPlace;
};

type FlyoutEvent = MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>;

const isKeyboardFocus = (element: HTMLElement): boolean => {
  try {
    return element.matches(':focus-visible');
  } catch {
    return false;
  }
};

const focusFirstFlyoutRow = (): void => {
  document.querySelector<HTMLElement>('[data-rail-flyout] button')?.focus();
};

export const RailSessions = ({ workspaceId, currentSessionId, place }: Props) => {
  const sessions = useSessions();
  const { all: pinned } = useRailPinned({ workspaceId });
  const flyout = useRailFlyout();
  const isStudioOver = isStudioOverSession({ place });
  const hasOpenSession = place === null || isStudioOver;
  const open: Session | null =
    !hasOpenSession || currentSessionId === null
      ? null
      : (sessionById(sessions, currentSessionId) ?? null);
  const others = pinned.filter((session) => session.id !== open?.id);
  const shown = others.slice(0, RAIL_PINNED_LIMIT);
  const extra = others.length - shown.length;
  const sign: RailSessionSign = place === null ? 'current' : 'remembered';
  const { target, close } = flyout;

  const select = (sessionId: SessionId) => {
    close();
    useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
  };

  const enterWith = (key: RailFlyoutKey) => (event: FlyoutEvent) =>
    flyout.enter({
      key,
      anchor: event.currentTarget,
      isImmediate:
        event.type === 'click' || (event.type === 'focus' && isKeyboardFocus(event.currentTarget)),
    });

  const keysWith = (key: RailFlyoutKey) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    if (target?.key === key) {
      focusFirstFlyoutRow();
      return;
    }
    flyout.enter({ key, anchor: event.currentTarget, isImmediate: true });
    window.requestAnimationFrame(focusFirstFlyoutRow);
  };

  if (open === null && shown.length === 0 && extra <= 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-1 pt-2" data-rail-sessions="">
      {open === null ? null : (
        <RailSessionButton
          session={open}
          sign={sign}
          hasFlyout
          onSelect={() => select(open.id as SessionId)}
          onEnter={enterWith('session')}
          onLeave={flyout.leave}
          onKeyDown={keysWith('session')}
        />
      )}
      {shown.map((session) => (
        <RailSessionButton
          key={session.id}
          session={session}
          sign="none"
          hasFlyout={false}
          onSelect={() => select(session.id as SessionId)}
        />
      ))}
      {extra > 0 ? (
        <RailMoreButton
          count={extra}
          onEnter={enterWith('more')}
          onLeave={flyout.leave}
          onKeyDown={keysWith('more')}
        />
      ) : null}
      <RailFlyout
        target={target}
        label={target?.key === 'more' ? 'Pinned sessions' : 'Session pages'}
        onKeep={flyout.keep}
        onLeave={flyout.leave}
        onClose={flyout.close}
        onDismiss={flyout.dismiss}
      >
        <RailFlyoutBody
          session={target?.key === 'session' ? open : null}
          pinned={pinned}
          currentSessionId={currentSessionId}
          hasStudioOver={isStudioOver}
          onSelectSession={select}
        />
      </RailFlyout>
    </div>
  );
};
