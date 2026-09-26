import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '../../cn';
import type { CrumbMenuAction, CrumbMenuModel, CrumbMenuRow as RowModel } from './crumbMenuTypes';
import { CrumbMenuActions } from './CrumbMenuActions';
import { CrumbMenuRow } from './CrumbMenuRow';

const FILTER_THRESHOLD = 9;

const META_WIDTH: Record<CrumbMenuModel['width'], string> = {
  narrow: 'w-28',
  regular: 'w-20',
  wide: 'w-16',
};

type Props = {
  readonly model: CrumbMenuModel;
  readonly confirmingId: string | null;
  readonly onConfirmingChange: (id: string | null) => void;
  readonly onClose: () => void;
};

const FOCUSABLE = '[data-crumb-row]:not([disabled]), [data-crumb-action], [data-crumb-filter]';

export const CrumbMenu = ({ model, confirmingId, onConfirmingChange, onClose }: Props) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const rowCount = model.groups.reduce((sum, group) => sum + group.rows.length, 0);
  const hasFilter = model.filterPlaceholder != null && rowCount >= FILTER_THRESHOLD;
  const needle = query.trim().toLowerCase();
  const groups = model.groups
    .map((group) => ({
      ...group,
      rows:
        needle === ''
          ? group.rows
          : group.rows.filter((row) =>
              `${row.label} ${row.secondary ?? ''}`.toLowerCase().includes(needle),
            ),
    }))
    .filter((group) => group.rows.length > 0);

  useEffect(() => {
    const root = rootRef.current;
    if (root == null) {
      return;
    }
    const target =
      root.querySelector<HTMLElement>('[data-crumb-filter]') ??
      root.querySelector<HTMLElement>('[data-crumb-row][aria-checked="true"]:not([disabled])') ??
      root.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  }, []);

  const activate = (row: RowModel) => {
    if (row.isDisabled) {
      return;
    }
    onClose();
    row.onSelect();
  };

  const run = (action: CrumbMenuAction) => {
    onConfirmingChange(null);
    onClose();
    action.onRun();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (root == null) {
      return;
    }
    if (event.key === 'Escape' && confirmingId != null) {
      event.preventDefault();
      event.stopPropagation();
      onConfirmingChange(null);
      return;
    }
    const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
    const index = items.findIndex((item) => item === document.activeElement);
    const focusAt = (next: number) => {
      const item = items[(next + items.length) % items.length];
      item?.focus();
    };
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(index + 1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusAt(index <= 0 ? items.length - 1 : index - 1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusAt(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusAt(items.length - 1);
      return;
    }
    if (hasFilter || event.key.length !== 1 || event.metaKey || event.ctrlKey) {
      return;
    }
    const letter = event.key.toLowerCase();
    const match = items.find(
      (item) =>
        item.hasAttribute('data-crumb-row') &&
        (item.textContent ?? '').trim().toLowerCase().startsWith(letter),
    );
    match?.focus();
  };

  return (
    <div
      ref={rootRef}
      data-crumb-menu=""
      onKeyDown={onKeyDown}
      className="flex min-h-0 flex-1 flex-col gap-1 p-1 motion-safe:animate-crumb-menu-in"
    >
      <div className="flex h-6.5 shrink-0 items-center justify-between gap-2 px-2 text-2xs text-faint-foreground">
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">{model.title}</span>
          {model.context != null ? ` · ${model.context}` : null}
        </span>
        {model.count != null ? <span className="shrink-0 tabular-nums">{model.count}</span> : null}
      </div>
      {hasFilter ? (
        <input
          data-crumb-filter=""
          type="text"
          value={query}
          placeholder={model.filterPlaceholder ?? undefined}
          aria-label={model.filterPlaceholder ?? undefined}
          onChange={(event) => setQuery(event.target.value)}
          className="h-7 shrink-0 rounded-md bg-fill px-2 text-xs text-foreground outline-none placeholder:text-faint-foreground focus-visible:ring-2 focus-visible:ring-focus-ring"
        />
      ) : null}
      <div data-crumb-list="" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {groups.map((group) => (
          <div
            key={group.id}
            role="group"
            aria-label={group.label ?? model.title}
            className="flex flex-col"
          >
            {group.label != null ? (
              <div className="flex h-6 items-center justify-between px-2 text-3xs font-medium uppercase tracking-eyebrow text-faint-foreground">
                <span className="truncate">{group.label}</span>
                <span className="tabular-nums">{group.rows.length}</span>
              </div>
            ) : null}
            {group.rows.map((row) => (
              <CrumbMenuRow
                key={row.id}
                row={row}
                metaWidthClass={META_WIDTH[model.width]}
                onActivate={activate}
              />
            ))}
          </div>
        ))}
      </div>
      {model.actions.length > 0 ? (
        <div className={cn('shrink-0')}>
          <CrumbMenuActions
            actions={model.actions}
            confirmingId={confirmingId}
            onConfirmingChange={onConfirmingChange}
            onRun={run}
          />
        </div>
      ) : null}
    </div>
  );
};
