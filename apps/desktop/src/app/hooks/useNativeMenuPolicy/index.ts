import { useEffect, useRef } from 'react';
import type { MenuPoint } from '@goodboy/ui';
import { keepsNativeMenu } from './keepsNativeMenu';

const EXTERNAL_LINK = /^(https?:|mailto:)/i;

type Params = {
  readonly onLink: (params: {
    readonly href: string;
    readonly point: MenuPoint;
    readonly opener: HTMLElement;
  }) => void;
};

const isMenuPress = (event: MouseEvent): boolean =>
  event.button === 2 || (event.button === 0 && event.ctrlKey);

const hasSelectedText = (): boolean => {
  const selection = window.getSelection();
  return selection !== null && !selection.isCollapsed && selection.toString().trim() !== '';
};

export const useNativeMenuPolicy = ({ onLink }: Params): void => {
  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;

  useEffect(() => {
    let isSelectionHeld: boolean | null = null;
    const onMouseDown = (event: MouseEvent) => {
      if (!isMenuPress(event)) {
        return;
      }
      isSelectionHeld = hasSelectedText();
    };
    const onContextMenuCapture = (event: MouseEvent) => {
      const wasHeld = isSelectionHeld;
      isSelectionHeld = null;
      const selection = wasHeld === false ? null : window.getSelection();
      if (keepsNativeMenu({ target: event.target, selection })) {
        event.stopPropagation();
      }
    };
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      const link = target.closest('a[href]');
      const href = link?.getAttribute('href') ?? '';
      if (link instanceof HTMLElement && EXTERNAL_LINK.test(href)) {
        onLinkRef.current({ href, point: { x: event.clientX, y: event.clientY }, opener: link });
      }
    };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('contextmenu', onContextMenuCapture, true);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('contextmenu', onContextMenuCapture, true);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);
};
