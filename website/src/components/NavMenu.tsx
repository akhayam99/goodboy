import './NavMenu.css';
import { useEffect, useRef, useState } from 'react';
import { StarButton } from './StarButton';
import { ThemeToggle } from './ThemeToggle';

export type NavMenuLink = {
  readonly label: string;
  readonly href: string;
  readonly isCurrent?: boolean;
};

type Props = {
  readonly links: readonly NavMenuLink[];
};

const SHEET_ID = 'nav-menu-sheet';

export const NavMenu = ({ links }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    sheetRef.current?.querySelector<HTMLElement>('a, button')?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [isOpen]);

  return (
    <span
      className="navMenu"
      ref={rootRef}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !rootRef.current?.contains(event.relatedTarget)
        ) {
          setIsOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost navMenuButton"
        aria-expanded={isOpen}
        aria-controls={SHEET_ID}
        onClick={() => setIsOpen((current) => !current)}
      >
        Menu
      </button>
      <div
        ref={sheetRef}
        id={SHEET_ID}
        className="navSheet"
        hidden={!isOpen}
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest('a')) {
            setIsOpen(false);
          }
        }}
      >
        <nav className="navSheetLinks" aria-label="Menu">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={link.isCurrent === true ? 'page' : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="navSheetRow">
          <span>Theme</span>
          <ThemeToggle />
        </div>
        <div className="navSheetAction onlyCoarse">
          <StarButton />
        </div>
      </div>
    </span>
  );
};
