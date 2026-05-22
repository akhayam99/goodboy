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

/**
 * Categorized palette with a prefix-routed grammar — the Raycast / Linear
 * model. Empty input shows all sources; typing a prefix (@ # : / ~ $ ?)
 * scopes the result list to one source. Plan section A.2.
 */
type PaletteGroup =
  | 'recents'
  | 'workspace'
  | 'session'
  | 'agent'
  | 'skill'
  | 'workflow'
  | 'script'
  | 'action'
  | 'help';

interface PaletteItem {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly group: PaletteGroup;
  readonly accent?: string;
  readonly icon?: string;
  readonly onSelect: () => void;
}

interface PrefixMeta {
  readonly symbol: string;
  readonly hint: string;
  readonly group: PaletteGroup;
}

const PREFIXES: ReadonlyArray<PrefixMeta> = [
  { symbol: '@', hint: 'agents in current session', group: 'agent' },
  { symbol: '#', hint: 'sessions', group: 'session' },
  { symbol: ':', hint: 'workspaces', group: 'workspace' },
  { symbol: '/', hint: 'skills', group: 'skill' },
  { symbol: '~', hint: 'workflows', group: 'workflow' },
  { symbol: '$', hint: 'scripts', group: 'script' },
  { symbol: '>', hint: 'actions', group: 'action' },
  { symbol: '?', hint: 'help & shortcuts', group: 'help' },
];

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

interface ParsedQuery {
  readonly prefix: PrefixMeta | null;
  readonly query: string;
}

function parseQuery(raw: string): ParsedQuery {
  const trimmed = raw.trimStart();
  if (trimmed.length === 0) return { prefix: null, query: '' };
  const ch = trimmed[0]!;
  const meta = PREFIXES.find((p) => p.symbol === ch);
  if (meta) {
    return { prefix: meta, query: trimmed.slice(1).trim() };
  }
  return { prefix: null, query: trimmed };
}

function fuzzyScore(query: string, text: string): number {
  if (query.length === 0) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.startsWith(q)) return 3;
  if (t.includes(` ${q}`)) return 2;
  if (t.includes(q)) return 1;
  return 0;
}

export interface CommandPaletteProps {
  onClose: () => void;
  onOpenSettings?: () => void;
  onNewSession?: () => void;
  onOpenShortcutHelp?: () => void;
}

export function CommandPalette({
  onClose,
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
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
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

  const parsed = useMemo(() => parseQuery(query), [query]);

  const items = useMemo<ReadonlyArray<PaletteItem>>(() => {
    const out: PaletteItem[] = [];

    // workspaces
    for (const w of workspaces) {
      out.push({
        id: `workspace:${w.id}`,
        label: w.name,
        sublabel: w.rootPath,
        group: 'workspace',
        onSelect: () => void setCurrentWorkspace(w.id),
      });
    }

    // sessions
    for (const s of sessions) {
      const ws = workspaces.find((w) => w.id === s.workspaceId);
      out.push({
        id: `session:${s.id}`,
        label: s.goal || 'untitled session',
        sublabel: ws?.name,
        group: 'session',
        onSelect: () => void setCurrentSession(s.id),
      });
    }

    // agents (in current session only — they only make sense there)
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

    // skills
    for (const sk of skills) {
      out.push({
        id: `skill:${sk.id}`,
        label: sk.name,
        sublabel: sk.description ?? 'skill',
        group: 'skill',
        onSelect: () => {
          /* skill invocation lives in chat input — palette can only navigate.
             Surface as a hint until we wire a deep-link into ChatInput. */
        },
      });
    }

    // workflows
    for (const wf of workflows) {
      out.push({
        id: `workflow:${wf.id}`,
        label: wf.name,
        sublabel: `${wf.steps.length} step${wf.steps.length === 1 ? '' : 's'}`,
        group: 'workflow',
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent('goodboy:open-settings', {
              detail: { section: 'phases' },
            }),
          );
        },
      });
    }

    // scripts
    for (const sc of scripts) {
      out.push({
        id: `script:${sc.id}`,
        label: sc.name,
        sublabel: 'workspace script',
        group: 'script',
        onSelect: () => {
          window.dispatchEvent(
            new CustomEvent('goodboy:open-settings', {
              detail: { section: 'scripts' },
            }),
          );
        },
      });
    }

    // actions
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

    // help
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
    agentKindOverride,
    setCurrentWorkspace,
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
      // When no query: prefix view shows the full scope; no-prefix view
      // caps to keep the list manageable.
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
      // empty + Tab → seed the next prefix (cycle through PREFIXES)
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
        if (e.target === e.currentTarget) onClose();
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

        {/* prefix legend strip when the input is empty — teaches grammar */}
        {parsed.prefix === null && query.length === 0 ? (
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
        ) : null}

        <ul ref={listRef} className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">no results</li>
          ) : (
            GROUP_ORDER.flatMap((group) => {
              const itemsInGroup = filtered.filter((it) => it.group === group);
              if (itemsInGroup.length === 0) return [];
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
}
