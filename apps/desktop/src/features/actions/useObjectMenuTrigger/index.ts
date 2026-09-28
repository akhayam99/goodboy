import { useCallback, useContext, type KeyboardEvent, type MouseEvent } from 'react';
import { keepsNativeMenu } from '../../../app/hooks/useNativeMenuPolicy/keepsNativeMenu';
import { ObjectMenuContext } from '../components/ObjectMenuProvider/objectMenuContext';
import type { ObjectTarget } from '../types';
import { eventMatches } from '../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../shared/keyboard/registry';

type Params = {
  readonly target: ObjectTarget | null;
  readonly anchorKey?: string | null;
  readonly onBeforeOpen?: () => ObjectTarget | null;
};

export type ObjectMenuTrigger = {
  readonly onContextMenu: (event: MouseEvent<HTMLElement>) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

const KEYBOARD_INSET = 8;

export const isMenuKey = (event: { readonly key: string; readonly shiftKey: boolean }): boolean =>
  (event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu';

export const useObjectMenuTrigger = ({
  target,
  anchorKey = null,
  onBeforeOpen,
}: Params): ObjectMenuTrigger => {
  const context = useContext(ObjectMenuContext);

  const openAt = useCallback(
    ({
      point,
      opener,
    }: {
      readonly point: { x: number; y: number };
      readonly opener: HTMLElement;
    }) => {
      if (context === null) {
        return false;
      }
      const resolved = onBeforeOpen === undefined ? target : onBeforeOpen();
      if (resolved === null) {
        return false;
      }
      context.open({ target: resolved, point, anchorKey, opener });
      return true;
    },
    [anchorKey, context, onBeforeOpen, target],
  );

  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (event.defaultPrevented) {
        return;
      }
      if (keepsNativeMenu({ target: event.target, selection: window.getSelection() })) {
        return;
      }
      if (openAt({ point: { x: event.clientX, y: event.clientY }, opener: event.currentTarget })) {
        event.preventDefault();
      }
    },
    [openAt],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (event.defaultPrevented || !isMenuKey(event)) {
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      if (
        openAt({
          point: { x: rect.left + KEYBOARD_INSET, y: rect.bottom },
          opener: event.currentTarget,
        })
      ) {
        event.preventDefault();
      }
    },
    [openAt],
  );

  return { onContextMenu, onKeyDown };
};
