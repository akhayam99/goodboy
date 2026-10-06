import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useEscapeLayer } from '@goodboy/ui';
import { sessionPlace, useAppStore } from '../../../../../store';
import { recentlyOpenedFirst } from '../../../../../store/slices/session-view/sortAndGroupSessions';
import { MODAL_SELECTOR, registerShortcut } from '../../../../../shared/keyboard/dispatcher';
import { isTerminalFocused } from '../../../../../shared/keyboard/isTerminalFocused';

const VISIBLE_AFTER_MS = 120;
const LIST_LIMIT = 8;

type Direction = 1 | -1;

type SwitcherState = {
  readonly ids: ReadonlyArray<SessionId>;
  readonly index: number;
  readonly isVisible: boolean;
};

type Switcher = {
  readonly state: SwitcherState | null;
  readonly choose: (index: number) => void;
};

const recentIds = (): ReadonlyArray<SessionId> => {
  const { sessions, currentSessionId } = useAppStore.getState();
  const recent = recentlyOpenedFirst(sessions).map((session) => session.id as SessionId);
  const current = recent.find((id) => id === currentSessionId);
  const rest = recent.filter((id) => id !== current);
  return (current === undefined ? rest : [current, ...rest]).slice(0, LIST_LIMIT);
};

const yieldsToFocus = (): boolean =>
  isTerminalFocused() || document.querySelector(MODAL_SELECTOR) !== null;

export const useSessionSwitcher = (): Switcher => {
  const [state, setState] = useState<SwitcherState | null>(null);
  const stateRef = useRef<SwitcherState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);

  const publish = useCallback((next: SwitcherState | null) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const finish = useCallback(
    ({ shouldOpen }: { readonly shouldOpen: boolean }) => {
      const current = stateRef.current;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      teardownRef.current?.();
      teardownRef.current = null;
      publish(null);
      if (!shouldOpen || current === null) {
        return;
      }
      const target = current.ids[current.index];
      if (target === undefined || target === useAppStore.getState().currentSessionId) {
        return;
      }
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId: target }) });
    },
    [publish],
  );

  const commit = useCallback(() => finish({ shouldOpen: true }), [finish]);
  const cancel = useCallback(() => finish({ shouldOpen: false }), [finish]);

  const arm = useCallback(() => {
    const onKeyUp = (event: KeyboardEvent): void => {
      if (event.key === 'Control') {
        commit();
      }
    };
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', cancel);
    teardownRef.current = () => {
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', cancel);
    };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const current = stateRef.current;
      if (current !== null) {
        publish({ ...current, isVisible: true });
      }
    }, VISIBLE_AFTER_MS);
  }, [cancel, commit, publish]);

  const press = useCallback(
    ({ direction }: { readonly direction: Direction }): boolean => {
      if (yieldsToFocus()) {
        return false;
      }
      const current = stateRef.current;
      if (current !== null) {
        const length = current.ids.length;
        publish({
          ids: current.ids,
          index: (current.index + direction + length) % length,
          isVisible: true,
        });
        return true;
      }
      const ids = recentIds();
      if (ids.length < 2) {
        return true;
      }
      publish({ ids, index: direction === 1 ? 1 : ids.length - 1, isVisible: false });
      arm();
      return true;
    },
    [arm, publish],
  );

  useEffect(() => {
    const unregisterNext = registerShortcut('session.switcher', () => press({ direction: 1 }), {
      canDecline: true,
    });
    const unregisterBack = registerShortcut(
      'session.switcherBack',
      () => press({ direction: -1 }),
      { canDecline: true },
    );
    return () => {
      unregisterNext();
      unregisterBack();
      finish({ shouldOpen: false });
    };
  }, [finish, press]);

  useEscapeLayer(cancel, state !== null);

  const choose = useCallback(
    (index: number) => {
      const current = stateRef.current;
      if (current === null) {
        return;
      }
      publish({ ...current, index });
      commit();
    },
    [commit, publish],
  );

  return { state, choose };
};
