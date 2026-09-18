import { ChevronDown, ChevronRight } from 'lucide-react';
import { Chip, Eyebrow, StatusDot, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { DiscoveredScript, ScriptGroup, ScriptRunRecord } from '../../scripts';
import { discoveredScriptCwd, discoveredScriptId } from '../../scripts';
import {
  groupScriptsByCategory,
  SCRIPT_CATEGORIES,
  type ScriptCategory,
} from '../../classifyScript';
import { DiscoveredScriptRow } from './DiscoveredScriptRow';

type RunParams = {
  readonly scriptId: string;
  readonly name: string;
  readonly command: string;
  readonly cwd: string;
};

type CancelParams = {
  readonly scriptId: string;
};

type Props = {
  readonly group: ScriptGroup;
  readonly worktreePath: string;
  readonly runs: Readonly<Record<string, ScriptRunRecord>> | undefined;
  readonly completedAt: Readonly<Record<string, number>>;
  readonly emptyLabel: string | null;
  readonly isOpen: boolean;
  readonly isRunning: boolean;
  readonly onToggle: () => void;
  readonly onRun: (params: RunParams) => void;
  readonly onCancel: (params: CancelParams) => void;
};

export const DiscoveredScriptGroup = ({
  group,
  worktreePath,
  runs,
  completedAt,
  emptyLabel,
  isOpen,
  isRunning,
  onToggle,
  onRun,
  onCancel,
}: Props) => {
  const cwd = discoveredScriptCwd({ worktreePath, relDir: group.relDir });
  const scripts = [...group.scripts].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );
  const scriptsByCategory = groupScriptsByCategory({ scripts });
  const presentCategories = SCRIPT_CATEGORIES.filter((category) =>
    scriptsByCategory.has(category.id),
  );
  const scriptsFor = (category: ScriptCategory): ReadonlyArray<DiscoveredScript> =>
    scriptsByCategory.get(category) ?? [];

  return (
    <section
      aria-label={`${group.packageName} scripts`}
      className="flex min-w-0 flex-1 flex-col gap-3"
    >
      <header className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="flex min-w-0 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)]"
          >
            {isOpen ? (
              <ChevronDown size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            ) : (
              <ChevronRight size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            )}
            <span
              role="heading"
              aria-level={3}
              className="truncate text-sm font-medium text-foreground"
            >
              {group.packageName}
            </span>
            {group.relDir !== '' ? (
              <span className="truncate font-mono text-3xs text-muted-foreground">
                {group.relDir}
              </span>
            ) : null}
            <Chip tone="neutral" label={group.manager} size="3xs" shape="badge" uppercase />
            <Chip tone="neutral" label={String(scripts.length)} size="3xs" />
          </button>
          {isRunning ? (
            <StatusDot tone="info" pulsing ariaLabel={`Running script in ${group.packageName}`} />
          ) : null}
        </div>
      </header>
      {isOpen && scripts.length === 0 && emptyLabel != null ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : null}
      {isOpen &&
        presentCategories.map((category) => {
          const Icon = category.icon;
          const tint = tintClasses(category.tone);
          const categoryScripts = scriptsFor(category.id);
          return (
            <section key={category.id} aria-label={`${category.label} scripts`}>
              <div className="flex flex-col gap-1.5">
                <Eyebrow
                  label={
                    <span className="flex items-center gap-1.5">
                      <span>{category.label}</span>
                      <span className="tabular-nums text-muted-foreground/60">
                        {categoryScripts.length}
                      </span>
                    </span>
                  }
                  icon={<Icon size={11} aria-hidden className={tint.icon} />}
                />
                <ul className="flex flex-col gap-1.5">
                  {categoryScripts.map((script) => {
                    const scriptId = discoveredScriptId({
                      worktreePath,
                      source: group.source,
                      relDir: group.relDir,
                      name: script.name,
                    });
                    const run = runs?.[scriptId] ?? null;
                    return (
                      <li key={scriptId}>
                        <DiscoveredScriptRow
                          scriptId={scriptId}
                          name={script.name}
                          command={script.command}
                          cwd={cwd}
                          run={run}
                          completedAt={run == null ? undefined : completedAt[run.runId]}
                          onRun={() =>
                            onRun({
                              scriptId,
                              name: script.name,
                              command: script.command,
                              cwd,
                            })
                          }
                          onCancel={() => onCancel({ scriptId })}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
    </section>
  );
};
