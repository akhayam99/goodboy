import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { useEscapeLayer } from '@goodboy/ui';

const TRIGGER_SELECTOR = '[aria-haspopup="menu"]';

type Props = {
  readonly children: ReactNode;
  readonly triggerWithin: RefObject<HTMLElement | null>;
  readonly onClose: () => void;
};

export const HeaderPanel = ({ children, triggerWithin, onClose }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus();
    const anchor = triggerWithin.current;
    return () => {
      anchor?.querySelector<HTMLElement>(TRIGGER_SELECTOR)?.focus();
    };
  }, [triggerWithin]);

  useEscapeLayer(onClose);

  return (
    <div ref={panelRef} data-header-panel className="min-w-0">
      {children}
    </div>
  );
};
