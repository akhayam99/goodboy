import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Plus, Smartphone, type LucideIcon } from 'lucide-react';
import { Divider, EmptyState, ScrollFade, inlineMarkdownText } from '@goodboy/ui';
import type { Agent, AgentId, SessionId, ProjectScript } from '@goodboy/types';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
} from '../../../../store';
import { AGENT_KIND_META, agentKindPalette, classifyAgent, type AgentKind } from '../../agent-kind';
import { parseQuery } from '../../../quick-actions';
import { PALETTE_PREFIXES, palettePlaceholder, type PaletteGroup } from './palettePrefixes';
import { useLensDestinations } from '../../hooks/useLensDestinations';
import { openLens } from '../../openLens';
import { SHORTCUTS } from '../../../../shared/keyboard/registry';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../../settings/reportIssueStudioEvent';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../../notifications/studioEvent';
import { useToast } from '../../../../app/components/Toast';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PaletteLeading } from './PaletteLeading';
import { LENS_ICON } from '../../lens-labels';
import { useThemeStore } from '../../../../shared/lib/theme';
import { linkedProjectsLabel } from '../../../workspace/linkedProjectsLabel';
import { shortcutGlyphs } from '../../../../shared/keyboard/registry';
import { requestNewSession } from '../../requestNewSession';
import { openImpactStudio } from '../../../impact/openImpactStudio';
import { openChangelogStudio } from '../../../changelog/changelogStudioEvent';
import type { SettingsFocus } from '../../../settings/components/SettingsStudio/types';

type PaletteItem = {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly group: PaletteGroup;
  readonly isDestination?: boolean;
  readonly accent?: string;
  readonly icon?: LucideIcon;
  readonly onSelect: () => void;
};

const GROUP_ICON: Record<PaletteGroup, LucideIcon> = {
  goto: CONCEPT_ICONS.nextSteps,
  workspace: CONCEPT_ICONS.workspace,
  session: CONCEPT_ICONS.sessions,
  agent: CONCEPT_ICONS.agents,
  script: CONCEPT_ICONS.scripts,
  action: CONCEPT_ICONS.nextSteps,
  help: CONCEPT_ICONS.help,
};

const GROUP_LABELS: Record<PaletteGroup, string> = {
  goto: 'Go to',
  workspace: 'Workspaces',
  session: 'Sessions',
  agent: 'Agents',
  script: 'Scripts',
  action: 'Actions',
  help: 'Help',
};

const GROUP_ORDER: ReadonlyArray<PaletteGroup> = [
  'agent',
  'session',
  'workspace',
  'goto',
  'script',
  'action',
  'help',
];

type QuotaBucket = PaletteGroup | 'destination';

const EMPTY_QUERY_QUOTA = {
  agent: 5,
  session: 8,
  workspace: 3,
  goto: 8,
  script: 3,
  action: 12,
  destination: 20,
  help: 2,
} satisfies Record<QuotaBucket, number>;

const bucketOf = (item: PaletteItem): QuotaBucket =>
  item.isDestination === true ? 'destination' : item.group;

const withGroupQuota = (items: ReadonlyArray<PaletteItem>): ReadonlyArray<PaletteItem> => {
  const taken: Record<QuotaBucket, number> = {
    agent: 0,
    session: 0,
    workspace: 0,
    goto: 0,
    script: 0,
    action: 0,
    destination: 0,
    help: 0,
  };
  return items.filter((item) => {
    const bucket = bucketOf(item);
    if (taken[bucket] >= EMPTY_QUERY_QUOTA[bucket]) {
      return false;
    }
    taken[bucket] += 1;
    return true;
  });
};

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
  readonly onClose: () => void;
  readonly initialQuery?: string;
};

const openSettings = (detail: SettingsFocus) =>
  window.dispatchEvent(new CustomEvent('goodboy:open-settings', { detail }));

export const CommandPalette = ({ onClose, initialQuery = '' }: Props) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const workspaces = useWorkspaces();
  const projects = useAppStore((s) => s.projects);
  const sessions = useSessions();
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const scripts = useAppStore((s) =>
    currentWorkspace ? (s.projectScripts[currentWorkspace.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<ProjectScript>;
  const agents = useAppStore((s) =>
    currentSession ? (s.sessionPhaseRuns[currentSession.id] ?? EMPTY_ARRAY) : EMPTY_ARRAY,
  ) as ReadonlyArray<Agent>;
  const agentKindOverride = useAppStore((s) => s.agentKindOverride);
  const destinations = useLensDestinations({
    sessionId: currentSession === null ? null : (currentSession.id as SessionId),
  });
  const runScript = useAppStore((s) => s.runScript);
  const reportError = useAppStore((s) => s.reportError);
  const { showToast } = useToast();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const parsed = useMemo(() => parseQuery(query), [query]);

  const items = useMemo<ReadonlyArray<PaletteItem>>(() => {
    const out: PaletteItem[] = [];

    for (const w of workspaces) {
      out.push({
        id: `workspace:${w.id}`,
        label: w.name,
        sublabel: linkedProjectsLabel({ projects, workspaceId: w.id }),
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
        label: inlineMarkdownText({ text: s.goal }) || 'untitled session',
        sublabel: ws?.name,
        group: 'session',
        onSelect: () => void setCurrentSession(s.id),
      });
    }

    if (currentSession) {
      for (const a of agents) {
        const kind: AgentKind = classifyAgent({
          agent: a,
          override: agentKindOverride[a.id as AgentId] ?? null,
        });
        out.push({
          id: `agent:${a.id}`,
          label: a.name,
          sublabel: AGENT_KIND_META[kind].label,
          group: 'agent',
          accent: agentKindPalette({ kind }).bg,
          onSelect: () => void selectAgent(currentSession.id, a.id as AgentId),
        });
      }
      const sessionId = currentSession.id as SessionId;
      for (const destination of destinations) {
        out.push({
          id: `action:lens:${destination.lens ?? 'overview'}`,
          label: `Open ${SHORTCUTS[destination.shortcut].label}`,
          sublabel: shortcutGlyphs(destination.shortcut),
          group: 'action',
          icon: destination.lens === null ? CONCEPT_ICONS.sessions : LENS_ICON[destination.lens],
          isDestination: true,
          onSelect: () => openLens({ sessionId, lens: destination.lens }),
        });
      }
    }

    if (currentSession) {
      out.push({
        id: 'goto:board',
        label: 'Back to board',
        sublabel: shortcutGlyphs('session.board'),
        group: 'goto',
        icon: CONCEPT_ICONS.workspace,
        onSelect: () => void setCurrentSession(null),
      });
    }
    if (currentWorkspace !== null) {
      out.push(
        {
          id: 'goto:inbox',
          label: 'Inbox',
          group: 'goto',
          icon: CONCEPT_ICONS.inbox,
          onSelect: () => window.dispatchEvent(new CustomEvent('goodboy:open-inbox')),
        },
        {
          id: 'goto:workflows',
          label: 'Workflows',
          group: 'goto',
          icon: CONCEPT_ICONS.workflows,
          onSelect: () => window.dispatchEvent(new CustomEvent('goodboy:open-workflow-studio')),
        },
        {
          id: 'goto:impact',
          label: 'Impact',
          group: 'goto',
          icon: CONCEPT_ICONS.impact,
          onSelect: () => openImpactStudio({}),
        },
        {
          id: 'goto:changelog',
          label: 'Changelog',
          group: 'goto',
          icon: CONCEPT_ICONS.changelog,
          onSelect: openChangelogStudio,
        },
        {
          id: 'goto:notifications',
          label: 'Notifications',
          group: 'goto',
          icon: CONCEPT_ICONS.notifications,
          onSelect: () => window.dispatchEvent(new CustomEvent(NOTIFICATIONS_STUDIO_EVENT)),
        },
        {
          id: 'goto:workspace-settings',
          label: 'Workspace settings',
          group: 'goto',
          icon: CONCEPT_ICONS.settings,
          onSelect: () => openSettings({ scope: 'workspace' }),
        },
      );
    }
    out.push({
      id: 'goto:add-workspace',
      label: 'Add workspace',
      group: 'goto',
      icon: Plus,
      onSelect: () => window.dispatchEvent(new CustomEvent('goodboy:add-workspace')),
    });

    for (const sc of scripts) {
      out.push({
        id: `script:${sc.id}`,
        label: sc.name,
        sublabel: 'project script',
        group: 'script',
        onSelect: () => {
          if (currentSession == null) {
            showToast({ kind: 'warning', message: `Open a session to run ${sc.name}.` });
            return;
          }
          const sessionId = currentSession.id;
          const failureTitle = `Couldn't run ${sc.name}`;
          void runScript({ sessionId, scriptId: sc.id })
            .then((result) => {
              if (result.exitCode !== 0) {
                void reportError({
                  title: failureTitle,
                  error: `Exited with code ${result.exitCode}.`,
                  sessionId,
                  action: { kind: 'open-lens', sessionId, lens: 'scripts' },
                });
                return;
              }
              showToast({ kind: 'success', message: `${sc.name} finished.` });
            })
            .catch((error: unknown) => reportError({ title: failureTitle, error, sessionId }));
        },
      });
    }

    out.push({
      id: 'action:settings',
      label: 'Open settings',
      sublabel: shortcutGlyphs('settings.open'),
      group: 'action',
      icon: CONCEPT_ICONS.settings,
      onSelect: () => openSettings({ scope: 'app' }),
    });
    if (currentWorkspace !== null) {
      out.push({
        id: 'action:new-session',
        label: 'New session',
        sublabel: shortcutGlyphs('session.new'),
        group: 'action',
        icon: Plus,
        onSelect: requestNewSession,
      });
    }

    out.push({
      id: 'action:toggle-theme',
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      group: 'action',
      icon: CONCEPT_ICONS.appearance,
      onSelect: () => toggleTheme(),
    });
    out.push({
      id: 'action:connect-provider',
      label: 'Connect a provider',
      group: 'action',
      icon: CONCEPT_ICONS.providers,
      onSelect: () => openSettings({ scope: 'providers' }),
    });
    out.push({
      id: 'action:pair-device',
      label: 'Pair your iPhone',
      group: 'action',
      icon: Smartphone,
      onSelect: () => window.dispatchEvent(new CustomEvent('goodboy:open-pair-device')),
    });
    out.push({
      id: 'action:report-issue',
      label: 'Report an issue',
      group: 'action',
      icon: CONCEPT_ICONS.reportIssue,
      onSelect: () => window.dispatchEvent(new CustomEvent(REPORT_ISSUE_STUDIO_EVENT)),
    });

    out.push({
      id: 'help:shortcuts',
      label: 'Keyboard shortcuts',
      sublabel: shortcutGlyphs('settings.shortcuts'),
      group: 'help',
      icon: CONCEPT_ICONS.shortcuts,
      onSelect: () => openSettings({ scope: 'app', section: 'shortcuts' }),
    });
    out.push({
      id: 'help:guide',
      label: 'Getting started',
      group: 'help',
      icon: CONCEPT_ICONS.guide,
      onSelect: () => window.dispatchEvent(new CustomEvent('goodboy:open-guide')),
    });

    return out;
  }, [
    workspaces,
    projects,
    sessions,
    agents,
    scripts,
    currentSession,
    currentWorkspace,
    runScript,
    reportError,
    showToast,
    agentKindOverride,
    destinations,
    openWorkspace,
    setCurrentSession,
    selectAgent,
    theme,
    toggleTheme,
  ]);

  const ordered = useMemo(() => {
    const { prefix, query: q } = parsed;
    const scope = prefix ? items.filter((it) => it.group === prefix.group) : items;
    const matched =
      q.length === 0
        ? prefix
          ? scope.slice(0, 50)
          : withGroupQuota(scope)
        : scope
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
    return [...matched].sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
  }, [items, parsed]);

  const selectedIndex = Math.max(
    0,
    ordered.findIndex((item) => item.id === selectedId),
  );
  const selected = ordered[selectedIndex] ?? null;
  const optionId = (id: string) => `${listboxId}-${id}`;

  useEffect(() => {
    setSelectedId(null);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (selected === null) {
      return;
    }
    listRef.current
      ?.querySelector(`[data-id="${CSS.escape(selected.id)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const moveSelection = (delta: number) => {
    const next = ordered[Math.min(Math.max(selectedIndex + delta, 0), ordered.length - 1)];
    if (next === undefined) {
      return;
    }
    setSelectedId(next.id);
  };

  const run = (item: PaletteItem) => {
    item.onSelect();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        moveSelection(1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        moveSelection(-1);
        return;
      case 'Enter':
        e.preventDefault();
        if (selected === null) {
          onClose();
          return;
        }
        run(selected);
        return;
      case 'Escape':
        e.preventDefault();
        onClose();
        return;
      case 'Tab':
        if (query.length > 0) {
          return;
        }
        e.preventDefault();
        setQuery(PALETTE_PREFIXES[0]?.symbol ?? '');
        return;
      default:
        return;
    }
  };

  const placeholder = palettePlaceholder({ prefix: parsed.prefix });

  return (
    <div
      className="fixed inset-0 z-command-palette flex items-start justify-center pt-[20vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-floating shadow-lg motion-safe:animate-studio-in">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={selected === null ? undefined : optionId(selected.id)}
          aria-label="Command palette search"
          className="w-full bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        />
        <Divider />

        {parsed.prefix === null && query.length === 0 && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 bg-subtle px-3 py-1.5 text-3xs text-muted-foreground">
            {PALETTE_PREFIXES.map((p) => (
              <button
                key={p.symbol}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery(p.symbol);
                  inputRef.current?.focus();
                }}
                aria-label={`Filter by ${p.hint}`}
                className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 transition-colors hover:bg-hover hover:text-foreground"
                title={p.hint}
              >
                <kbd className="font-mono text-foreground">{p.symbol}</kbd>
                <span>{p.hint}</span>
              </button>
            ))}
          </div>
        )}

        <ScrollFade className="max-h-80">
          <ul ref={listRef} id={listboxId} role="listbox" aria-label="Commands">
            {ordered.length === 0 ? (
              <li role="presentation">
                <EmptyState
                  icon={CONCEPT_ICONS.search}
                  tone={CONCEPT_TONE.search}
                  title="No results"
                  size="inline"
                  className="justify-center px-4 py-6"
                />
              </li>
            ) : (
              ordered.flatMap((item, index) => {
                const isSelected = index === selectedIndex;
                const row = (
                  <li
                    key={item.id}
                    id={optionId(item.id)}
                    data-id={item.id}
                    role="option"
                    aria-selected={isSelected}
                    className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm ${
                      isSelected ? 'bg-muted' : 'hover:bg-hover'
                    }`}
                    onMouseEnter={() => setSelectedId(item.id)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      run(item);
                    }}
                  >
                    <PaletteLeading
                      accent={item.accent}
                      icon={item.icon ?? GROUP_ICON[item.group]}
                    />
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
                if (ordered[index - 1]?.group === item.group) {
                  return [row];
                }
                return [
                  <li
                    key={`group:${item.group}`}
                    role="presentation"
                    className="bg-subtle px-4 py-1 text-2xs font-medium tracking-wide text-muted-foreground"
                  >
                    {GROUP_LABELS[item.group]}
                  </li>,
                  row,
                ];
              })
            )}
          </ul>
        </ScrollFade>
      </div>
    </div>
  );
};
