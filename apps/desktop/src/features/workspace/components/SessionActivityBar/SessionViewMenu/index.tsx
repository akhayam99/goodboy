import { useEffect, useRef } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { AnchoredPopover, cn, Divider, Eyebrow, Tooltip, useDropdown } from '@goodboy/ui';
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

type SessionViewMenuProps = {
  readonly workspaceId: WorkspaceId;
};

export const SessionViewMenu = ({ workspaceId }: SessionViewMenuProps) => {
  const prefs = useSessionViewPrefs(workspaceId);
  const setSessionSort = useAppStore((s) => s.setSessionSort);
  const setSessionGroup = useAppStore((s) => s.setSessionGroup);

  const { hold, release } = useSidebarPeekHold();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdown = useDropdown({
    align: 'start',
    width: 'w-[200px]',
    expectedWidth: MENU_WIDTH,
    expectedHeight: 220,
    isEscapeEnabled: false,
  });
  const { open, close, toggle } = dropdown;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    hold();
    return () => release();
  }, [hold, open, release]);

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="menu"
      ariaLabel="Session display options"
      className="py-1"
      hasBackdrop
      trigger={
        <Tooltip content="Display options" side="bottom">
          <button
            ref={triggerRef}
            type="button"
            onClick={toggle}
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
      }
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
    </AnchoredPopover>
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
