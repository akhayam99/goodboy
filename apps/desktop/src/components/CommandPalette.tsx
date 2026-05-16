import { useEffect, useRef, useState } from 'react';
import { useAppStore, useWorkspaces, useSessions } from '../store';

function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  group: 'workspace' | 'task' | 'action';
  onSelect: () => void;
}

export interface CommandPaletteProps {
  onClose: () => void;
  onNavigateToSession?: (sessionId: string, workspaceId: string) => void;
  onOpenSettings?: () => void;
  onNewSession?: () => void;
  onOpenShortcutHelp?: () => void;
}

export function CommandPalette({
  onClose,
  onNavigateToSession,
  onOpenSettings,
  onNewSession,
  onOpenShortcutHelp,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const workspaces = useWorkspaces();
  const sessions = useSessions();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);

  const allItems: PaletteItem[] = [
    ...workspaces.map((w) => ({
      id: `workspace:${w.id}`,
      label: w.name,
      group: 'workspace' as const,
      onSelect: () => void setCurrentWorkspace(w.id),
    })),
    ...sessions.map((s) => {
      const ws = workspaces.find((w) => w.id === s.workspaceId);
      return {
        id: `session:${s.id}`,
        label: s.goal,
        sublabel: ws?.name,
        group: 'task' as const,
        onSelect: () => {
          if (onNavigateToSession) {
            onNavigateToSession(s.id, s.workspaceId);
          } else {
            void setCurrentSession(s.id);
          }
        },
      };
    }),
    {
      id: 'action:settings',
      label: 'open settings',
      group: 'action' as const,
      onSelect: () => onOpenSettings?.(),
    },
    {
      id: 'action:new-session',
      label: 'new session',
      group: 'action' as const,
      onSelect: () => onNewSession?.(),
    },
    {
      id: 'action:shortcut-help',
      label: 'open shortcut help',
      group: 'action' as const,
      onSelect: () => onOpenShortcutHelp?.(),
    },
  ];

  const filteredItems =
    query.trim() === ''
      ? allItems.slice(0, 20)
      : allItems
          .map((item) => ({
            item,
            score: Math.max(
              fuzzyScore(query, item.label),
              item.sublabel ? fuzzyScore(query, item.sublabel) : 0,
            ),
          }))
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ item }) => item)
          .slice(0, 20);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filteredItems[selectedIndex]?.onSelect();
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const groups: Array<PaletteItem['group']> = ['workspace', 'task', 'action'];
  const groupLabels: Record<PaletteItem['group'], string> = {
    workspace: 'workspaces',
    task: 'tasks',
    action: 'actions',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/20"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-background shadow-2xl overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          placeholder="search workspaces, sessions, actions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="search workspaces, sessions, and actions"
          className="w-full px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] bg-background border-b border-border"
        />
        <ul ref={listRef} className="max-h-64 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">no results</li>
          ) : (
            groups.flatMap((group) => {
              const items = filteredItems.filter((item) => item.group === group);
              if (items.length === 0) return [];
              return [
                <li
                  key={`group:${group}`}
                  className="px-4 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {groupLabels[group]}
                </li>,
                ...items.map((item) => {
                  const idx = filteredItems.indexOf(item);
                  return (
                    <li
                      key={item.id}
                      className={`px-4 py-2 text-sm cursor-pointer flex flex-col ${idx === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'}`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        item.onSelect();
                        onClose();
                      }}
                    >
                      <span>{item.label}</span>
                      {item.sublabel ? (
                        <span className="text-xs text-muted-foreground">{item.sublabel}</span>
                      ) : null}
                    </li>
                  );
                }),
              ];
            })
          )}
        </ul>
      </div>
    </div>
  );
}
