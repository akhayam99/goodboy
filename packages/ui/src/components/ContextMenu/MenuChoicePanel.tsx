import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import { cn } from '../../cn';
import { ScrollFade } from '../ScrollFade';
import { focusFirstMenuItem, isMenuNavigationKey, moveMenuFocus } from './menuKeys';
import type { MenuChoice } from './menuTypes';

const PANEL_WIDTH = 224;
const EDGE = 8;
const GAP = 4;

type Props = {
  readonly label: string;
  readonly choices: ReadonlyArray<MenuChoice>;
  readonly anchor: HTMLElement;
  readonly onChoose: (choice: string) => void;
  readonly onBack: () => void;
  readonly onClose: () => void;
};

type Position = {
  readonly left: number;
  readonly top: number;
};

export const MenuChoicePanel = ({ label, choices, anchor, onChoose, onBack, onClose }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 0;
    const fitsRight = rect.right + GAP + PANEL_WIDTH <= window.innerWidth - EDGE;
    const left = fitsRight ? rect.right + GAP : Math.max(EDGE, rect.left - GAP - PANEL_WIDTH);
    const top = Math.max(EDGE, Math.min(rect.top - GAP, window.innerHeight - EDGE - height));
    setPosition({ left, top });
  }, [anchor]);

  useLayoutEffect(() => {
    if (position === null || panelRef.current === null) {
      return;
    }
    const current = panelRef.current.querySelector<HTMLElement>('[aria-checked="true"]');
    if (current === null) {
      focusFirstMenuItem({ container: panelRef.current });
      return;
    }
    current.focus();
  }, [position]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = panelRef.current;
    if (container === null) {
      return;
    }
    if (isMenuNavigationKey(event.key)) {
      event.preventDefault();
      moveMenuFocus({ container, key: event.key });
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onBack();
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      data-menu-panel
      data-menu-portal
      onKeyDown={onKeyDown}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: PANEL_WIDTH,
        visibility: position === null ? 'hidden' : 'visible',
      }}
      className="fixed z-popover flex max-h-80 flex-col rounded-lg border border-border bg-floating text-label shadow-lg motion-safe:animate-popover-in"
    >
      <ScrollFade
        className="flex min-h-0 flex-1 flex-col"
        viewportClassName="flex h-auto min-h-0 flex-1 flex-col p-1"
        fadeSize={12}
        fadeFrom="floating"
      >
        {choices.map((choice) => (
          <button
            key={choice.id}
            type="button"
            role="menuitemradio"
            aria-checked={choice.isCurrent}
            tabIndex={-1}
            data-menu-label={choice.label}
            onClick={() => onChoose(choice.id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-foreground hover:bg-hover focus:bg-hover focus-visible:outline-none',
              choice.isCurrent && 'text-row',
            )}
          >
            <span className="min-w-0 flex-1 truncate">{choice.label}</span>
            {choice.isCurrent ? (
              <Check size={12} aria-hidden className="shrink-0 text-muted-foreground" />
            ) : null}
          </button>
        ))}
      </ScrollFade>
    </div>,
    document.body,
  );
};
