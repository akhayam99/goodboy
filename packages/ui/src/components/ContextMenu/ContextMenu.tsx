import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../cn';
import { FLOATING_SURFACE } from '../../floatingSurface';
import { ScrollFade } from '../ScrollFade';
import { MenuList } from './MenuList';
import { placeContextMenu } from './placeContextMenu';
import { useEscapeLayer } from '../../useEscapeLayer';
import type { MenuEntry, MenuPoint } from './menuTypes';

type Props = {
  readonly label: string;
  readonly point: MenuPoint;
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly onClose: () => void;
};

export const ContextMenu = ({ label, point, entries, onClose }: Props) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState<MenuPoint | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEscapeLayer(() => onCloseRef.current());

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (node === null) {
      return;
    }
    setPlaced(
      placeContextMenu({
        point,
        width: node.offsetWidth,
        height: node.offsetHeight,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    );
  }, [point, entries.length]);

  useEffect(() => {
    const close = () => onCloseRef.current();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (
        menuRef.current?.contains(target) === true ||
        target.closest('[data-menu-portal]') !== null
      ) {
        return;
      }
      close();
    };
    document.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
    };
  }, []);

  return createPortal(
    <div
      ref={menuRef}
      data-context-menu
      data-menu-portal
      onContextMenu={(event) => event.preventDefault()}
      style={{
        left: placed?.x ?? point.x,
        top: placed?.y ?? point.y,
        visibility: placed === null ? 'hidden' : 'visible',
      }}
      className={cn(
        FLOATING_SURFACE,
        'fixed z-popover flex max-h-[calc(100vh-16px)] max-w-80 flex-col text-label motion-safe:animate-popover-in',
      )}
    >
      <ScrollFade
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName="h-auto min-h-0 flex-1"
        fadeSize={12}
        fadeFrom="floating"
      >
        <MenuList label={label} entries={entries} onClose={onClose} />
      </ScrollFade>
    </div>,
    document.body,
  );
};
