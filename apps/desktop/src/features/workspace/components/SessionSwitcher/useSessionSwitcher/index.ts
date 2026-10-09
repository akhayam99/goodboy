import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useEscapeLayer } from '@goodboy/ui';
import { sessionPlace, useAppStore } from '../../../../../store';
import { MODAL_SELECTOR, registerShortcut } from '../../../../../shared/keyboard/dispatcher';
import { isTerminalFocused } from '../../../../../shared/keyboard/isTerminalFocused';
import { switcherOrderOf, type SwitcherOrder } from '../switcherOrder';

const VISIBLE_AFTER_MS = 120;

type Direction = 1 | -1;

type SwitcherState = {
  readonly ids: ReadonlyArray<SessionId>;
  readonly pinnedCount: number;
  readonly index: number;
  readonly isVisible: boolean;
};

type Switcher = {
  readonly state: SwitcherState | null;
  readonly choose: (index: number) => void;
};

const currentOrder = (): SwitcherOrder => {
  const { sessions, currentSessionId, currentWorkspaceId, sessionPins } = useAppStore.getState();
  const pins = currentWorkspaceId === null ? [] : (sessionPins[currentWorkspaceId] ?? []);
  return switcherOrderOf({
    sessions,
    currentSessionId,
    pinnedIds: pins.map((pin) => pin.id),
  });
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
          pinnedCount: current.pinnedCount,
          index: (current.index + direction + length) % length,
          isVisible: true,
        });
        return true;
      }
      const { ids, pinnedCount, previousIndex } = currentOrder();
      if (ids.length < 2) {
        return true;
      }
      publish({
        ids,
        pinnedCount,
        index: direction === 1 ? Math.max(previousIndex, 0) : ids.length - 1,
        isVisible: false,
      });
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
