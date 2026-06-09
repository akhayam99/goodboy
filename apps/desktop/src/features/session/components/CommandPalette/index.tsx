import { useEffect, useMemo, useRef, useState } from 'react';
import type { Agent, AgentId, Skill, Workflow, WorkspaceScript } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
} from '../../../../store';
import {
  AGENT_KIND_META,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
  type AgentKind,
} from '../../agent-kind';
import { PREFIXES, parseQuery, type QuickActionGroup } from '../../../quick-actions';
import { useToast } from '../../../../app/components/Toast';

type PaletteGroup = QuickActionGroup | 'recents';

type PaletteItem = {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly group: PaletteGroup;
  readonly accent?: string;
  readonly icon?: string;
  readonly onSelect: () => void;
};

const GROUP_LABELS: Record<PaletteGroup, string> = {
  recents: 'Recents',
  workspace: 'Workspaces',
  session: 'Sessions',
  agent: 'Agents',
  skill: 'Skills',
  workflow: 'Workflows',
  script: 'Scripts',
  action: 'Actions',
  help: 'Help',
};

const GROUP_ORDER: ReadonlyArray<PaletteGroup> = [
  'recents',
  'agent',
  'session',
  'workspace',
  'skill',
  'workflow',
  'script',
  'action',
  'help',
];

function fuzzyScore(query: string, text: string): number {
  if (query.length === 0) {
    return 1;
  }
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) {
    return 3;
  }
  if (t.includes(` ${q}`)) {
    return 2;
  }
  if (t.includes(q)) {
    return 1;
  }
  return 0;
}

export type Props = {
  onClose: () => void;
  onOpenSettings?: () => void;
  onNewSession?: () => void;
  onOpenShortcutHelp?: () => void;
  initialQuery?: string;
};

export const CommandPalette = ({
  onClose,
  onOpenSettings,
  onNewSession,
  onOpenShortcutHelp,
  initialQuery = '',
}: Props) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const workspaces = useWorkspaces();
  const sessions = useSessions();
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const skills = useAppStore((s) =>
    currentWorkspace ? (s.skills[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Skill>;
  const workflows = useAppStore((s) =>
    currentWorkspace ? (s.phaseTemplates[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Workflow>;
  const scripts = useAppStore((s) =>
    currentWorkspace ? (s.workspaceScripts[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<WorkspaceScript>;
  const agents = useAppStore((s) =>
    currentSession ? (s.sessionPhaseRuns[currentSession.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Agent>;
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const runScript = useAppStore((s) => s.runScript);
  const sessionWorktree = useAppStore((s) =>
    currentSession ? (s.sessionWorktrees[currentSession.id]?.[0] ?? null) : null,
  );
  const { showToast } = useToast();

  const parsed = useMemo(() => parseQuery(query), [query]);

  const items = useMemo<ReadonlyArray<PaletteItem>>(() => {
    const out: PaletteItem[] = [];

    for (const w of workspaces) {
      out.push({
        id: `workspace:${w.id}`,
        label: w.name,
        sublabel: w.rootPath,
        group: 'workspace',
        onSelect: () => void openWorkspace(w.id, w.name),
      });
    }

    for (const s of sessions) {
      if (s.archivedAt) {
        continue;
      }
      const ws = workspaces.find((w) => w.id === s.workspaceId);
      out.push({
        id: `session:${s.id}`,
        label: s.goal || 'untitled session',
        sublabel: ws?.name,
        group: 'session',
        onSelect: () => void setCurrentSession(s.id),
      });
    }

    if (currentSession) {
      for (const a of agents) {
        const kind: AgentKind =
          agentKindOverride[a.id as AgentId] ?? inferAgentKindFromName(a.name);
        out.push({
          id: `agent:${a.id}`,
          label: a.name,
          sublabel: AGENT_KIND_META[kind].label,
          group: 'agent',
          accent: AGENT_KIND_PALETTE[kind].bg,
          onSelect: () => void selectAgent(currentSession.id, a.id as AgentId),
        });
      }
    }

    for (const sk of skills) {
      out.push({
        id: `skill:${sk.id}`,
        label: sk.name,
        sublabel: sk.description ?? 'skill',
        group: 'skill',
        onSelect: () => {
          /* skill invocation lives in chat input, palette can only navigate.
             Surface as a hint until we wire a deep-link into ChatInput. */
        },
      });
    }

    for (const wf of workflows) {
      out.push({
        id: `workflow:${wf.id}`,
        label: wf.name,
        sublabel: `${wf.steps.length} step${wf.steps.length === 1 ? '' : 's'}`,
        group: 'workflow',
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent('goodboy:open-workspace-settings', {
              detail: { section: 'phases' },
            }),
          );
        },
      });
    }

    for (const sc of scripts) {
      out.push({
        id: `script:${sc.id}`,
        label: sc.name,
        sublabel: 'workspace script',
        group: 'script',
        onSelect: () => {
          if (!currentSession || !sessionWorktree) {
            showToast('warning', `${sc.name}, open a session worktree to run scripts`);
            return;
          }
          void runScript(currentSession.id, sc.id, sessionWorktree).then((result) => {
            showToast(
              result.exitCode === 0 ? 'success' : 'error',
              result.exitCode === 0 ? `${sc.name}, done` : `${sc.name}, exited ${result.exitCode}`,
            );
          });
        },
      });
    }

    if (onOpenSettings) {
      out.push({
        id: 'action:settings',
        label: 'Open settings',
        sublabel: '⌘,',
        group: 'action',
        onSelect: () => onOpenSettings(),
      });
    }
    if (onNewSession) {
      out.push({
        id: 'action:new-session',
        label: 'New session',
        group: 'action',
        onSelect: () => onNewSession(),
      });
    }

    if (onOpenShortcutHelp) {
      out.push({
        id: 'help:shortcuts',
        label: 'Keyboard shortcuts',
        sublabel: '⌘/',
        group: 'help',
        onSelect: () => onOpenShortcutHelp(),
      });
    }

    return out;
  }, [
    workspaces,
    sessions,
    agents,
    skills,
    workflows,
    scripts,
    currentSession,
    sessionWorktree,
    runScript,
    showToast,
    agentKindOverride,
    openWorkspace,
    setCurrentSession,
    selectAgent,
    onOpenSettings,
    onNewSession,
    onOpenShortcutHelp,
  ]);

  const filtered = useMemo(() => {
    const { prefix, query: q } = parsed;
    const scope = prefix ? items.filter((it) => it.group === prefix.group) : items;
    if (q.length === 0) {
      return prefix ? scope.slice(0, 50) : scope.slice(0, 30);
    }
    return scope
      .map((item) => ({
        item,
        score: Math.max(
          fuzzyScore(q, item.label),
          item.sublabel ? fuzzyScore(q, item.sublabel) : 0,
        ),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item)
      .slice(0, 30);
  }, [items, parsed]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length, query]);

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
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selectedIndex]?.onSelect();
      onClose();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab' && query.length === 0) {
      e.preventDefault();
      const first = PREFIXES[0]!;
      setQuery(first.symbol);
    }
  };

  const placeholder = parsed.prefix
    ? `Search ${parsed.prefix.hint}…`
    : 'Search anything, or type @ # : / ~ $ > ? to filter';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[20vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="command palette search"
          className="w-full border-b border-border bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
        />

        {parsed.prefix === null && query.length === 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-soft bg-subtle/30 px-3 py-1.5 text-[10px] text-muted-foreground">
            {PREFIXES.map((p) => (
              <button
                key={p.symbol}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(p.symbol);
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-foreground/5 hover:text-foreground"
                title={p.hint}
              >
                <kbd className="font-mono text-foreground/80">{p.symbol}</kbd>
                <span>{p.hint}</span>
              </button>
            ))}
          </div>
        )}

        <ul ref={listRef} className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">no results</li>
          ) : (
            GROUP_ORDER.flatMap((group) => {
              const itemsInGroup = filtered.filter((it) => it.group === group);
              if (itemsInGroup.length === 0) {
                return [];
              }
              return [
                <li
                  key={`group:${group}`}
                  className="bg-subtle/20 px-4 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground/80"
                >
                  {GROUP_LABELS[group]}
                </li>,
                ...itemsInGroup.map((item) => {
                  const idx = filtered.indexOf(item);
                  return (
                    <li
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-2 px-4 py-2 text-sm ${
                        idx === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        item.onSelect();
                        onClose();
                      }}
                    >
                      {item.accent ? (
                        <span
                          aria-hidden
                          className={`size-1.5 shrink-0 rounded-full ${item.accent}`}
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <span className="block truncate">{item.label}</span>
                        {item.sublabel ? (
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.sublabel}
                          </span>
                        ) : null}
                      </div>
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
};
