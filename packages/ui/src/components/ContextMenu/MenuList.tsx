import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { InlineConfirm } from '../InlineConfirm';
import { MenuChoicePanel } from './MenuChoicePanel';
import { MenuRow } from './MenuRow';
import {
  focusFirstMenuItem,
  isMenuNavigationKey,
  isTypeaheadKey,
  moveMenuFocus,
  typeaheadMenuFocus,
} from './menuKeys';
import type { MenuEntry, MenuItemEntry } from './menuTypes';

const TYPEAHEAD_RESET_MS = 500;

type Props = {
  readonly label: string;
  readonly entries: ReadonlyArray<MenuEntry>;
  readonly onClose: () => void;
  readonly isAutoFocus?: boolean;
};

type Expanded = {
  readonly key: string;
  readonly anchor: HTMLElement;
};

export const MenuList = ({ label, entries, onClose, isAutoFocus = true }: Props) => {
  const listRef = useRef<HTMLDivElement>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Expanded | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const typeahead = useRef({ query: '', at: 0 });
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const items = entries.filter((entry): entry is MenuItemEntry => entry.kind === 'item');
  const confirming = items.find((entry) => entry.key === confirmKey) ?? null;
  const confirm = confirming?.confirm ?? null;
  const expandedEntry = items.find((entry) => entry.key === expanded?.key) ?? null;

  useLayoutEffect(() => {
    if (!isAutoFocus || listRef.current === null || confirm !== null) {
      return;
    }
    focusFirstMenuItem({ container: listRef.current });
  }, [isAutoFocus, confirm]);

  useEffect(() => {
    if (confirmKey !== null && confirming === null) {
      setConfirmKey(null);
    }
  }, [confirmKey, confirming]);

  const select = async ({
    entry,
    choice,
  }: {
    readonly entry: MenuItemEntry;
    readonly choice: string | null;
  }) => {
    onClose();
    await entry.onSelect(choice);
  };

  const activate = (entry: MenuItemEntry) => {
    if (entry.blockedReason != null) {
      return;
    }
    if (entry.choices != null && entry.choices.length > 0) {
      const anchor = rowRefs.current.get(entry.key);
      if (anchor !== undefined) {
        setExpanded({ key: entry.key, anchor });
      }
      return;
    }
    if (entry.confirm != null) {
      setExpanded(null);
      setConfirmKey(entry.key);
      return;
    }
    void select({ entry, choice: null });
  };

  const closeSubmenu = () => {
    const key = expanded?.key ?? null;
    setExpanded(null);
    if (key !== null) {
      rowRefs.current.get(key)?.focus();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const container = listRef.current;
    if (container === null) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (confirmKey !== null) {
        setConfirmKey(null);
        return;
      }
      onClose();
      return;
    }
    if (confirmKey !== null) {
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      onClose();
      return;
    }
    if (isMenuNavigationKey(event.key)) {
      event.preventDefault();
      moveMenuFocus({ container, key: event.key });
      return;
    }
    if (!isTypeaheadKey(event)) {
      return;
    }
    const now = Date.now();
    const query =
      now - typeahead.current.at > TYPEAHEAD_RESET_MS
        ? event.key
        : `${typeahead.current.query}${event.key}`;
    typeahead.current = { query, at: now };
    if (typeaheadMenuFocus({ container, query })) {
      event.preventDefault();
    }
  };

  const onRowKeyDown = ({
    event,
    entry,
  }: {
    readonly event: KeyboardEvent<HTMLButtonElement>;
    readonly entry: MenuItemEntry;
  }) => {
    if (event.key === 'ArrowRight' && entry.choices != null && entry.choices.length > 0) {
      event.preventDefault();
      activate(entry);
    }
  };

  if (confirming !== null && confirm !== null) {
    const Icon = confirming.icon;
    return (
      <div ref={listRef} data-menu-panel onKeyDown={onListKeyDown} className="w-80 max-w-full">
        <InlineConfirm
          role={confirm.role}
          icon={Icon === undefined ? null : <Icon size={14} aria-hidden />}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          surface="plain"
          isBusy={isBusy}
          note={
            confirm.notes === undefined || confirm.notes.length === 0 ? undefined : (
              <ul className="flex min-w-0 flex-col gap-0.5 text-muted-foreground">
                {confirm.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )
          }
          {...(confirm.alt !== undefined && {
            altAction: {
              label: confirm.alt.label,
              onClick: () => {
                onClose();
                void confirm.alt?.onSelect();
              },
            },
          })}
          onConfirm={async () => {
            setIsBusy(true);
            try {
              await confirming.onSelect(null);
            } finally {
              setIsBusy(false);
              onClose();
            }
          }}
          onCancel={() => setConfirmKey(null)}
        />
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="menu"
      aria-label={label}
      data-menu-panel
      onKeyDown={onListKeyDown}
      className="flex min-w-48 flex-col p-1"
    >
      {entries.map((entry) => {
        if (entry.kind === 'separator') {
          return <div key={entry.key} role="separator" className="my-1 h-px bg-border-soft" />;
        }
        if (entry.kind === 'header') {
          return (
            <div
              key={entry.key}
              role="presentation"
              className="truncate px-2 pt-1.5 pb-0.5 text-eyebrow text-faint-foreground"
            >
              {entry.label}
            </div>
          );
        }
        return (
          <MenuRow
            key={entry.key}
            entry={entry}
            isExpanded={expanded?.key === entry.key}
            rowRef={(node) => {
              if (node === null) {
                rowRefs.current.delete(entry.key);
                return;
              }
              rowRefs.current.set(entry.key, node);
            }}
            onActivate={() => activate(entry)}
            onHover={() => {
              if (expanded !== null && expanded.key !== entry.key) {
                setExpanded(null);
              }
            }}
            onKeyDown={(event) => onRowKeyDown({ event, entry })}
          />
        );
      })}
      {expanded !== null && expandedEntry !== null && expandedEntry.choices != null ? (
        <MenuChoicePanel
          label={expandedEntry.label}
          choices={expandedEntry.choices}
          anchor={expanded.anchor}
          onChoose={(choice) => void select({ entry: expandedEntry, choice })}
          onBack={closeSubmenu}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
};
