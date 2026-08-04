import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, SlidersHorizontal } from 'lucide-react';
import { Divider, Eyebrow, Popover, Tooltip, cn } from '@goodboy/ui';
import type { SessionGroupKey, SessionSortKey, WorkspaceId } from '@goodboy/types';
import { useAppStore, useSessionViewPrefs } from '../../../../../store';
import { useSidebarPeekHold } from '../../SidebarPeekOverlay/hold';

type SortOption = {
  readonly key: SessionSortKey;
  readonly label: string;
  readonly hint: string;
};

type GroupOption = {
  readonly key: SessionGroupKey;
  readonly label: string;
  readonly hint: string;
};

const SORT_OPTIONS: ReadonlyArray<SortOption> = [
  { key: 'updatedAt', label: 'Recent', hint: 'Last active first' },
  { key: 'createdAt', label: 'Oldest', hint: 'First created first' },
  { key: 'goal', label: 'A–Z', hint: 'By session goal' },
];

const GROUP_OPTIONS: ReadonlyArray<GroupOption> = [
  { key: 'stage', label: 'Stage', hint: 'Needs you, running, review…' },
  { key: 'pr', label: 'Pull request', hint: 'Draft, review, merged…' },
  { key: 'none', label: 'None', hint: 'Flat list' },
];

const MENU_WIDTH = 200;
const VIEWPORT_MARGIN = 8;

type SessionViewMenuProps = {
  readonly workspaceId: WorkspaceId;
};

export const SessionViewMenu = ({ workspaceId }: SessionViewMenuProps) => {
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionSort = useAppStore((s) => s.setSessionSort);
  const setSessionGroup = useAppStore((s) => s.setSessionGroup);

  const { hold, release } = useSidebarPeekHold();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const desiredLeft = rect.left;
      const maxLeft = window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN;
      const left = Math.min(Math.max(desiredLeft, VIEWPORT_MARGIN), maxLeft);
      const top = rect.bottom + 6;
      setCoords({ top, left });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    hold();
    return () => release();
  }, [hold, open, release]);

  return (
    <>
      <Tooltip content="Display options" side="bottom">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Display options"
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded p-1 motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
            open
              ? 'bg-foreground/10 text-foreground'
              : 'text-muted-foreground/70 hover:bg-foreground/10 hover:text-foreground',
          )}
        >
          <SlidersHorizontal size={11} aria-hidden />
        </button>
      </Tooltip>

      {open && coords
        ? createPortal(
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
              <Popover
                role="menu"
                ariaLabel="Session display options"
                className="fixed z-40 py-1"
                style={{ top: coords.top, left: coords.left, width: MENU_WIDTH }}
              >
                <MenuSection title="Sort by">
                  {SORT_OPTIONS.map((opt) => (
                    <MenuItem
                      key={opt.key}
                      label={opt.label}
                      hint={opt.hint}
                      selected={prefs.sort === opt.key}
                      onClick={() => {
                        setSessionSort(workspaceId, opt.key);
                      }}
                    />
                  ))}
                </MenuSection>
                <Divider />
                <MenuSection title="Group by">
                  {GROUP_OPTIONS.map((opt) => (
                    <MenuItem
                      key={opt.key}
                      label={opt.label}
                      hint={opt.hint}
                      selected={prefs.group === opt.key}
                      onClick={() => {
                        setSessionGroup(workspaceId, opt.key);
                      }}
                    />
                  ))}
                </MenuSection>
              </Popover>
            </>,
            document.body,
          )
        : null}
    </>
  );
};

type MenuSectionProps = {
  readonly title: string;
  readonly children: React.ReactNode;
};

function MenuSection({ title, children }: MenuSectionProps) {
  return (
    <div className="px-1 py-1">
      <Eyebrow label={title} muted className="px-2 pb-1 pt-0.5" />
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

type MenuItemProps = {
  readonly label: string;
  readonly hint: string;
  readonly selected: boolean;
  readonly onClick: () => void;
};

function MenuItem({ label, hint, selected, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs motion-safe:transition-colors',
        selected
          ? 'text-foreground'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <span className="flex w-3 shrink-0 items-center justify-center text-primary">
        {selected ? <Check size={11} aria-hidden /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{label}</span>
        <span className="truncate text-2xs text-muted-foreground/60">{hint}</span>
      </span>
    </button>
  );
}
