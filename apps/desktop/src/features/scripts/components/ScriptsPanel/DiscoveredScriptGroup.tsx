import { Collapsible } from '@goodboy/ui';
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

  return (
    <section aria-label={`${group.packageName} scripts`}>
      <Collapsible
        open={open}
        onOpenChange={onOpenChange}
        className="border border-border-soft"
        trigger={
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
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-3xs font-semibold uppercase text-muted-foreground">
              {group.manager}
            </span>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-3xs tabular-nums text-muted-foreground">
              {scripts.length}
            </span>
          </span>
        }
      >
        <ul className="flex flex-col gap-1.5 pt-1.5">
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
      </Collapsible>
    </section>
  );
};
