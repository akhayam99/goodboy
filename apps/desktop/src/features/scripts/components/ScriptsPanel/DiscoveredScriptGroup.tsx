import type { ScriptGroup, ScriptRunRecord } from '../../scripts';
import { discoveredScriptCwd, discoveredScriptId } from '../../scripts';
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
  readonly onRun: (params: RunParams) => void;
  readonly onCancel: (params: CancelParams) => void;
};

export const DiscoveredScriptGroup = ({
  group,
  worktreePath,
  runs,
  completedAt,
  onRun,
  onCancel,
}: Props) => {
  const cwd = discoveredScriptCwd({ worktreePath, relDir: group.relDir });
  const scripts = [...group.scripts].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }),
  );

  return (
    <section className="flex flex-col gap-2" aria-label={`${group.packageName} scripts`}>
      <div className="flex min-w-0 items-baseline gap-2 px-0.5">
        <h3 className="truncate text-sm font-medium text-foreground">{group.packageName}</h3>
        {group.relDir !== '' ? (
          <span className="truncate font-mono text-3xs text-muted-foreground">{group.relDir}</span>
        ) : null}
        <span className="shrink-0 text-3xs tabular-nums text-muted-foreground/70">
          {scripts.length}
        </span>
        <span className="h-px flex-1 bg-border/40" aria-hidden />
      </div>
      <ul className="flex flex-col gap-2">
        {scripts.map((script) => {
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
    </section>
  );
};
