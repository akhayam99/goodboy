import { Chip, Collapsible, Eyebrow, Tooltip, cn, tintClasses } from '@goodboy/ui';
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
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onRun: (params: RunParams) => void;
  readonly onCancel: (params: CancelParams) => void;
};

export const DiscoveredScriptGroup = ({
  group,
  worktreePath,
  runs,
  completedAt,
  open,
  onOpenChange,
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
    <section aria-label={`${group.packageName} scripts`}>
      <Collapsible
        open={open}
        onOpenChange={onOpenChange}
        className="border border-border-soft"
        trigger={
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex min-w-0 items-center gap-2">
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
            </span>
            <span className="flex flex-wrap items-center gap-1" aria-label="Script categories">
              {presentCategories.map((category) => {
                const Icon = category.icon;
                const tint = tintClasses(category.tone);
                return (
                  <Tooltip
                    key={category.id}
                    content={`${category.label}: ${scriptsFor(category.id).length}`}
                  >
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-3xs tabular-nums ring-1',
                        tint.bgSoft,
                        tint.ring,
                        tint.text,
                      )}
                      data-testid={`category-strip-${category.id}`}
                    >
                      <Icon size={10} aria-hidden />
                      {scriptsFor(category.id).length}
                    </span>
                  </Tooltip>
                );
              })}
            </span>
          </span>
        }
      >
        <div className="flex flex-col gap-3 pt-2">
          {presentCategories.map((category) => {
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
        </div>
      </Collapsible>
    </section>
  );
};
