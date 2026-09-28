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

export const useNativeMenuPolicy = ({ onLink }: Params): void => {
  const onLinkRef = useRef(onLink);
  onLinkRef.current = onLink;

  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      if (keepsNativeMenu({ target: event.target, selection: window.getSelection() })) {
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
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, []);
};
